import "dotenv/config";

import crypto from "node:crypto";
import express from "express";

import { execFile } from "node:child_process";
import { promisify } from "node:util";

import {
  mkdtemp,
  mkdir,
  writeFile,
  rm,
} from "node:fs/promises";

import os from "node:os";
import path from "node:path";

import http from "node:http";
import Docker from "dockerode";
import { WebSocketServer } from "ws";

const execFileAsync = promisify(execFile);

const app = express();

const dockerApi = new Docker();

const PORT =
  Number(process.env.RUNNER_PORT || 7070);

const RUNNER_API_TOKEN =
  process.env.RUNNER_API_TOKEN;

const RUNNER_IMAGE =
  process.env.RUNNER_IMAGE || "node:22-alpine";

const RUNNER_LINUX_IMAGE =
  process.env.RUNNER_LINUX_IMAGE ||
  "labplay-linux-basic:1.0";

const MEMORY_MB =
  Number(process.env.RUNNER_MEMORY_MB || 256);

const CPUS =
  String(process.env.RUNNER_CPUS || "0.5");

const PIDS_LIMIT =
  Number(process.env.RUNNER_PIDS_LIMIT || 64);

if (!RUNNER_API_TOKEN) {
  throw new Error(
    "RUNNER_API_TOKEN is required"
  );
}

app.use(
  express.json({
    limit: "2mb",
  })
);


/* =========================================================
   DOCKER HELPER
========================================================= */

async function docker(args, options = {}) {
  return execFileAsync(
    "docker",
    args,
    {
      windowsHide: true,
      maxBuffer: 1024 * 1024,
      ...options,
    }
  );
}


async function dockerExecExitCode(
  sandboxId,
  command,
  {
    user = "root",
    workingDir,
  } = {}
) {
  const container =
    dockerApi.getContainer(sandboxId);

  const exec =
    await container.exec({
      Cmd: command,

      AttachStdout: true,
      AttachStderr: true,

      Tty: false,

      User: user,

      ...(workingDir
        ? {
            WorkingDir: workingDir,
          }
        : {}),
    });

  const stream =
    await exec.start({
      hijack: true,
      stdin: false,
    });

  await new Promise(
    (resolve, reject) => {
      stream.on("end", resolve);
      stream.on("error", reject);

      stream.resume();
    }
  );

  const result =
    await exec.inspect();

  return Number(result.ExitCode);
}

/* =========================================================
   AUTH
   Samo naš backend/worker sme da zove Runner.
========================================================= */

function requireRunnerAuth(req, res, next) {
  const authorization =
    req.get("authorization") || "";

  const match =
    authorization.match(
      /^Bearer\s+(.+)$/i
    );

  if (!match) {
    return res.status(401).json({
      message:
        "Runner authentication required",
    });
  }

  const received =
    Buffer.from(match[1]);

  const expected =
    Buffer.from(RUNNER_API_TOKEN);

  if (
    received.length !== expected.length ||
    !crypto.timingSafeEqual(
      received,
      expected
    )
  ) {
    return res.status(401).json({
      message: "Invalid runner token",
    });
  }

  next();
}


/* =========================================================
   IMENA SANDBOX-A

   Za isti Attempt uvek dobijamo isto ime.

   Ovo je važno ako BullMQ retry-uje provisioning.
========================================================= */

function sandboxName(attemptId) {
  const safe =
    String(attemptId)
      .replace(/[^a-zA-Z0-9_.-]/g, "");

  return `labplay-${safe}`;
}


function volumeName(attemptId) {
  const safe =
    String(attemptId)
      .replace(/[^a-zA-Z0-9_.-]/g, "");

  return `labplay-workspace-${safe}`;
}


/* =========================================================
   DA LI CONTAINER POSTOJI?
========================================================= */

async function getContainer(name) {
  try {
    const { stdout } =
      await docker([
        "inspect",
        name,
      ]);

    const result =
      JSON.parse(stdout);

    return result[0] || null;
  } catch {
    return null;
  }
}


/* =========================================================
   BEZBEDNA PUTANJA FAJLA

   Ne dozvoljavamo:
   ../../etc/passwd
   C:\...
   /etc/passwd
========================================================= */

function safeFilePath(value) {
  if (
    typeof value !== "string" ||
    !value ||
    value.includes("\0")
  ) {
    return null;
  }

  const converted =
    value.replaceAll("\\", "/");

  const normalized =
    path.posix.normalize(converted);

  if (
    normalized.startsWith("/") ||
    normalized === ".." ||
    normalized.startsWith("../")
  ) {
    return null;
  }

  return normalized;
}


/* =========================================================
   KOJI JS FAJL POKREĆEMO?
========================================================= */

function findEntryFile(files) {
  const preferred = [
    "index.js",
    "main.js",
    "app.js",
  ];

  for (const filename of preferred) {
    const found =
      files.find(
        (file) =>
          file.path === filename
      );

    if (found) {
      return found.path;
    }
  }

  return files.find(
    (file) =>
      file.path.endsWith(".js")
  )?.path;
}


function normalizeOutput(value = "") {
  return String(value)
    .replaceAll("\r\n", "\n")
    .replace(/\n$/, "");
}


/* =========================================================
   HEALTH
========================================================= */

app.get(
  "/health",
  async (_req, res) => {
    try {
      await docker([
        "info",
        "--format",
        "{{.ServerVersion}}",
      ]);

      res.json({
        ok: true,
        service: "labplay-runner",
        docker: true,
      });
    } catch {
      res.status(503).json({
        ok: false,
        service: "labplay-runner",
        docker: false,
      });
    }
  }
);


/* =========================================================
   1. PROVISION SANDBOX

   Backend kaže:

   "Počinje Attempt ABC.
    Napravi mu sandbox."

   OVDE STVARNO NASTAJE DOCKER CONTAINER.
========================================================= */
function sandboxProfile(profile) {
  if (profile === "node-basic") {
    return {
      image: RUNNER_IMAGE,
      user: "node",
      owner: "node:node",
      workdir: "/workspace",
      volumeTarget: "/workspace",
    };
  }

  if (profile === "linux-basic") {
    return {
      image: RUNNER_LINUX_IMAGE,
      user: "bob",
      owner: "bob:bob",
      workdir: "/home/bob",
      volumeTarget: "/home/bob",
    };
  }

  return null;
}

app.post(
  "/v1/sandboxes",
  requireRunnerAuth,

  async (req, res, next) => {
    try {
      const {
        attemptId,
        profile,
        expiresAt,
      } = req.body || {};

      if (
        !attemptId ||
        !profile ||
        !expiresAt
      ) {
        return res.status(400).json({
          message:
            "attemptId, profile and expiresAt are required",
        });
      }

      /*
        Za sada podržavamo naš
        prvi JavaScript profil.
      */
     const selectedProfile =
  sandboxProfile(profile);

if (!selectedProfile) {
  return res.status(400).json({
    message:
      `Unsupported sandbox profile: ${profile}`,
  });
}
      const container =
        sandboxName(attemptId);

      const volume =
        volumeName(attemptId);


      /*
        Ako BullMQ ponovi isti job,
        NE pravimo novi container.

        Vratimo postojeći.
      */
      const existing =
        await getContainer(container);

      if (existing) {
        if (!existing.State?.Running) {
          await docker([
            "start",
            container,
          ]);
        }

        return res.status(200).json({
          id: container,
        });
      }


      /*
        Workspace živi koliko i sandbox.
      */
      await docker([
        "volume",
        "create",

        "--label",
        "labplay.managed=true",

        "--label",
        `labplay.attemptId=${attemptId}`,

        volume,
      ]);


      /*
        Podesimo owner workspace-a.

        Glavni learner container
        neće raditi kao root.
      */
      await docker([
        "run",
        "--rm",

       "--user",
"root",

"--mount",
`type=volume,source=${volume},target=${selectedProfile.volumeTarget}`,

selectedProfile.image,

"sh",
"-c",
`chown -R ${selectedProfile.owner} ${selectedProfile.volumeTarget}`,
      ]);


      /*
        Napravi container.

        VAŽNO:
        create != start

        create napravi container,
        zatim ga startujemo.
      */
      await docker([
        "create",

        "--name",
        container,

        "--hostname",
        "labplay",

        "--label",
        "labplay.managed=true",

        "--label",
        `labplay.attemptId=${attemptId}`,

        "--label",
        `labplay.expiresAt=${expiresAt}`,

        "--label",
        `labplay.profile=${profile}`,

        /*
          Učenik nema internet.
        */
        "--network",
        "none",

        /*
          Resource limits.
        */
        "--memory",
        `${MEMORY_MB}m`,

        "--cpus",
        CPUS,

        "--pids-limit",
        String(PIDS_LIMIT),

        /*
          Ne dozvoljavamo dodatne
          Linux capabilities.
        */
        "--cap-drop",
        "ALL",

        "--security-opt",
        "no-new-privileges",

        /*
          Root filesystem image-a
          je read-only.

          /workspace je poseban
          writable volume.
        */
        "--read-only",

        "--tmpfs",
        "/tmp:rw,size=64m",

       "--mount",
`type=volume,source=${volume},target=${selectedProfile.volumeTarget}`,

"--workdir",
selectedProfile.workdir,

"--user",
selectedProfile.user,

selectedProfile.image,

        /*
          Container ostaje živ
          dok traje Attempt.
        */
        "sh",
        "-c",
        "while true; do sleep 3600; done",
      ]);


      await docker([
        "start",
        container,
      ]);


      console.log(
        `[runner] sandbox created: ${container}`
      );


      res.status(201).json({
        id: container,
      });

    } catch (error) {
      next(error);
    }
  }
);


/* =========================================================
   PREBACIVANJE UČENIKOVIH FAJLOVA
   U POSTOJEĆI CONTAINER
========================================================= */

async function copyFilesToSandbox(
  sandboxId,
  files
) {
  const tempDirectory =
    await mkdtemp(
      path.join(
        os.tmpdir(),
        "labplay-files-"
      )
    );

  try {
    for (const file of files) {
      const safe =
        safeFilePath(file.path);

      if (!safe) {
        throw Object.assign(
          new Error(
            "Invalid file path"
          ),
          {
            statusCode: 400,
          }
        );
      }

      if (
        typeof file.content !== "string"
      ) {
        throw Object.assign(
          new Error(
            "Invalid file content"
          ),
          {
            statusCode: 400,
          }
        );
      }

      if (
        Buffer.byteLength(
          file.content,
          "utf8"
        ) > 200_000
      ) {
        throw Object.assign(
          new Error(
            "File is too large"
          ),
          {
            statusCode: 413,
          }
        );
      }

      const destination =
        path.join(
          tempDirectory,
          ...safe.split("/")
        );

      await mkdir(
        path.dirname(destination),
        {
          recursive: true,
        }
      );

      await writeFile(
        destination,
        file.content,
        "utf8"
      );
    }


    /*
      Kopiramo sadržaj temp foldera
      u ISTI postojeći container.

      Container se ne pravi ponovo.
    */
    await docker([
      "cp",
      `${tempDirectory}${path.sep}.`,
      `${sandboxId}:/workspace`,
    ]);


  } finally {
    await rm(
      tempDirectory,
      {
        recursive: true,
        force: true,
      }
    );
  }
}


/* =========================================================
   IZVRŠAVANJE KODA
   UNUTAR POSTOJEĆEG CONTAINER-A
========================================================= */

async function executeJavaScript(
  sandboxId,
  entryFile,
  timeoutMs
) {
  try {
    const { stdout, stderr } =
      await docker(
        [
          "exec",

          "--workdir",
          "/workspace",

          sandboxId,

          "node",
          entryFile,
        ],
        {
          timeout: timeoutMs,
          maxBuffer:
            1024 * 1024,
        }
      );


    return {
      exitCode: 0,
      stdout:
        stdout || "",
      stderr:
        stderr || "",
      timedOut: false,
    };

  } catch (error) {

    const timedOut =
      Boolean(error.killed) ||
      error.signal === "SIGTERM";

    return {
      exitCode:
        typeof error.code === "number"
          ? error.code
          : 1,

      stdout:
        String(
          error.stdout || ""
        ),

      stderr:
        String(
          error.stderr ||
          error.message ||
          ""
        ),

      timedOut,
    };
  }
}


async function linuxCheck(
  sandboxId,
  checker
) {
  if (!checker?.type) {
    return {
      passed: false,
      systemError: true,
      feedback: [
        "Checker nije konfigurisan.",
      ],
    };
  }

  /* =========================
     DIRECTORY EXISTS
  ========================= */

  if (checker.type === "directory_exists") {
  const targetPath =
    String(checker.path || "").trim();

  console.log("[PATH DEBUG]", {
    value: targetPath,
    length: targetPath.length,
    hex: Buffer.from(
      targetPath,
      "utf8"
    ).toString("hex"),
  });

  try {
    // 1. Testiramo potpuno ručno upisanu putanju
    const hardcodedExitCode =
      await dockerExecExitCode(
        sandboxId,
        [
          "/usr/bin/test",
          "-d",
          "/home/bob/projects",
        ],
        {
          user: "bob",
        }
      );

    console.log("[HARDCODED TEST]", {
      sandboxId,
      exitCode: hardcodedExitCode,
    });

    // 2. Testiramo putanju koja dolazi iz checker-a
    const exitCode =
      await dockerExecExitCode(
        sandboxId,
        [
          "/usr/bin/test",
          "-d",
          targetPath,
        ],
        {
          user: "bob",
        }
      );

    console.log("[LINUX CHECK RESULT]", {
      sandboxId,
      path: targetPath,
      exitCode,
    });

    if (exitCode === 0) {
      console.log("[LINUX CHECK PASS]");

      return {
        passed: true,
        systemError: false,
        feedback: [],
      };
    }

    if (exitCode === 1) {
      return {
        passed: false,
        systemError: false,
        feedback: [
          `Direktorijum ${targetPath} još ne postoji.`,
        ],
      };
    }

    return {
      passed: false,
      systemError: true,
      feedback: [
        "Greška pri proveri direktorijuma.",
      ],
    };

  } catch (error) {
    console.error(
      "[LINUX CHECK ERROR]",
      error
    );

    return {
      passed: false,
      systemError: true,
      feedback: [
        "Tehnička greška pri proveri.",
      ],
    };
  }
}

  /* =========================
     FILE EXISTS
  ========================= */

  if (
  checker.type ===
  "file_exists"
) {
  const targetPath =
    String(checker.path || "").trim();

  try {
    const exitCode =
      await dockerExecExitCode(
        sandboxId,
        [
          "/usr/bin/test",
          "-f",
          targetPath,
        ],
        {
          user: "bob",
        }
      );

    if (exitCode === 0) {
      return {
        passed: true,
        systemError: false,
        feedback: [],
      };
    }

    if (exitCode === 1) {
      return {
        passed: false,
        systemError: false,
        feedback: [
          `Fajl ${targetPath} još ne postoji.`,
        ],
      };
    }

    return {
      passed: false,
      systemError: true,
      feedback: [
        "Nije moguće proveriti fajl.",
      ],
    };

  } catch (error) {
    console.error(
      "[FILE EXISTS ERROR]",
      error
    );

    return {
      passed: false,
      systemError: true,
      feedback: [
        "Provera fajla trenutno nije dostupna.",
      ],
    };
  }
}
   
  /* =========================
     FILE CONTAINS
  ========================= */

  if (
  checker.type ===
  "file_contains"
) {
  const targetPath =
    String(checker.path || "").trim();

  const expected =
    String(checker.expected || "");

  try {
    const exitCode =
      await dockerExecExitCode(
        sandboxId,
        [
          "/usr/bin/grep",
          "-Fq",
          "--",
          expected,
          targetPath,
        ],
        {
          user: "bob",
        }
      );

    if (exitCode === 0) {
      return {
        passed: true,
        systemError: false,
        feedback: [],
      };
    }

    if (exitCode === 1) {
      return {
        passed: false,
        systemError: false,
        feedback: [
          "Sadržaj fajla još nije ispravan.",
        ],
      };
    }

    return {
      passed: false,
      systemError: true,
      feedback: [
        "Nije moguće proveriti sadržaj fajla.",
      ],
    };

  } catch (error) {
    console.error(
      "[FILE CONTAINS ERROR]",
      error
    );

    return {
      passed: false,
      systemError: true,
      feedback: [
        "Provera sadržaja fajla trenutno nije dostupna.",
      ],
    };
  }
}

  /* =========================
     PERMISSIONS
  ========================= */

  if (
    checker.type ===
    "permissions"
  ) {
    try {
      const {
        stdout,
      } =
        await docker([
          "exec",

          "--user",
          "bob",

          sandboxId,

          "stat",
          "-c",
          "%a",

          checker.path,
        ]);

      const actual =
        stdout.trim();

      const expected =
        String(
          checker.expected
        );

      return {
        passed:
          actual === expected,

        systemError: false,

        feedback:
          actual === expected
            ? []
            : [
                `Permissions su ${actual}, a potrebno je ${expected}.`,
              ],
      };
    } catch (error) {
      console.error(
        "[PERMISSIONS ERROR]",
        error
      );

      return {
        passed: false,
        systemError: true,
        feedback: [
          "Nije moguće proveriti permissions.",
        ],
      };
    }
  }

  /* =========================
     OWNER
  ========================= */

  if (
    checker.type ===
    "owner"
  ) {
    try {
      const {
        stdout,
      } =
        await docker([
          "exec",

          "--user",
          "bob",

          sandboxId,

          "stat",
          "-c",
          "%U",

          checker.path,
        ]);

      const actual =
        stdout.trim();

      const expected =
        String(
          checker.expected
        );

      return {
        passed:
          actual === expected,

        systemError: false,

        feedback:
          actual === expected
            ? []
            : [
                `Owner je ${actual}, očekuje se ${expected}.`,
              ],
      };
    } catch (error) {
      console.error(
        "[OWNER ERROR]",
        error
      );

      return {
        passed: false,
        systemError: true,
        feedback: [
          "Nije moguće proveriti owner-a.",
        ],
      };
    }
  }

  return {
    passed: false,

    systemError: true,

    feedback: [
      `Nepoznat Linux checker: ${checker.type}`,
    ],
  };
}
/* =========================================================
   2. RUN / CHECK
========================================================= */

app.post(
  "/v1/grade",
  requireRunnerAuth,

  async (req, res, next) => {
    const startedAt =
      Date.now();

    try {
      const {
        sandboxId,
        taskType,
        mode,
        files,
        checker,
        resourceLimits = {},
      } = req.body || {};


      /*
        Sandbox mora stvarno da postoji.
      */
      const sandbox =
        await getContainer(
          sandboxId
        );

      if (!sandbox) {
        return res.status(404).json({
          message:
            "Sandbox not found",
        });
      }


      if (!sandbox.State?.Running) {
        return res.status(409).json({
          message:
            "Sandbox is not running",
        });
      }


      if (
  taskType === "linux_state"
) {
  const result =
    await linuxCheck(
      sandboxId,
      checker
    );

  return res.json({
    passed:
      result.passed,

    systemError:
      result.systemError ||
      false,

    output: "",

    feedback:
      result.feedback ||
      [],

    runtimeMs:
      Date.now() -
      startedAt,
  });
}

      /*
        Za sada radimo code/JavaScript.
      */
      if (taskType !== "code") {
        return res.json({
          passed: false,
          systemError: true,
          output: "",
          feedback: [
            "Ovaj tip laba još nije podržan.",
          ],
          runtimeMs:
            Date.now() - startedAt,
        });
      }


      if (
        !Array.isArray(files) ||
        files.length === 0 ||
        files.length > 40
      ) {
        return res.status(400).json({
          message:
            "Invalid files",
        });
      }


      const cleanFiles =
        files.map((file) => ({
          path:
            safeFilePath(
              file.path
            ),

          content:
            file.content,
        }));


      if (
        cleanFiles.some(
          (file) =>
            !file.path ||
            typeof file.content !==
              "string"
        )
      ) {
        return res.status(400).json({
          message:
            "Invalid file",
        });
      }


      /*
        Ovde fajlovi ulaze
        U POSTOJEĆI sandbox.
      */
      await copyFilesToSandbox(
        sandboxId,
        cleanFiles
      );


      const entryFile =
        findEntryFile(
          cleanFiles
        );


      if (!entryFile) {
        return res.json({
          passed: false,
          systemError: false,
          output: "",
          feedback: [
            "Nije pronađen JavaScript fajl za pokretanje.",
          ],
          runtimeMs:
            Date.now() - startedAt,
        });
      }


      const requestedTimeout =
        Number(
          resourceLimits.timeoutMs
        ) || 5000;


      /*
        Čak i ako neko stavi
        ogroman timeout u DB,
        Runner ima gornju granicu.
      */
      const timeoutMs =
        Math.min(
          Math.max(
            requestedTimeout,
            500
          ),
          15_000
        );


      const execution =
        await executeJavaScript(
          sandboxId,
          entryFile,
          timeoutMs
        );


      if (execution.timedOut) {
        return res.json({
          passed: false,
          systemError: false,

          output:
            execution.stdout,

          feedback: [
            "Program je prekoračio vremensko ograničenje.",
          ],

          runtimeMs:
            Date.now() - startedAt,
        });
      }


      const output =
        [
          execution.stdout,
          execution.stderr,
        ]
          .filter(Boolean)
          .join("");


      /*
        Syntax error ili runtime error
        učenikovog programa nije
        kvar naše aplikacije.
      */
      if (
        execution.exitCode !== 0
      ) {
        return res.json({
          passed: false,

          systemError: false,

          output,

          feedback: [
            "Program se završio greškom. Pogledaj Output.",
          ],

          runtimeMs:
            Date.now() - startedAt,
        });
      }


      /* =========================
         RUN
      ========================= */

      if (
        mode === "run" ||
        checker?.type ===
          "visible_run"
      ) {
        return res.json({
          passed: true,

          systemError: false,

          output:
            execution.stdout,

          feedback: [],

          runtimeMs:
            Date.now() - startedAt,
        });
      }


      /* =========================
         CHECK

         Naš prvi checker:

         stdout_equals
      ========================= */

      if (
        checker?.type ===
        "stdout_equals"
      ) {
        const actual =
          normalizeOutput(
            execution.stdout
          );

        const expected =
          normalizeOutput(
            checker.expected
          );

        const passed =
          actual === expected;


        return res.json({
          passed,

          systemError: false,

          output:
            execution.stdout,

          feedback:
            passed
              ? []
              : [
                  `Očekivani izlaz je "${expected}", a tvoj program je ispisao "${actual}".`,
                ],

          runtimeMs:
            Date.now() - startedAt,
        });
      }


      /*
        Nepoznat checker ne izvršavamo.
      */
      console.error(
        "[runner] unsupported checker",
        checker
      );


      return res.json({
        passed: false,

        systemError: true,

        output:
          execution.stdout,

        feedback: [
          "Provera ovog zadatka trenutno nije dostupna.",
        ],

        runtimeMs:
          Date.now() - startedAt,
      });


    } catch (error) {
      next(error);
    }
  }
);


/* =========================================================
   DESTROY SANDBOX

   Cilj:
   posle ove funkcije ne sme da postoji
   ni container ni njegov workspace volume.

   Funkcija je idempotentna:
   može bezbedno da se pozove više puta.
========================================================= */

app.post(
  "/v1/sandboxes/destroy",

  requireRunnerAuth,

  async (
    req,
    res,
    next
  ) => {
    try {
      const {
  attemptId,
  sandboxId:
    requestedSandboxId,
} =
  req.body || {};


      if (
        
        !attemptId
      ) {
        return res
          .status(400)
          .json({
            message:
              "attemptId are required",
          });
      }

      const sandboxId =
  requestedSandboxId ||
  sandboxName(
    attemptId
  );

     
      /* =========================
         1. CONTAINER
      ========================= */

      const sandbox =
        await getContainer(
          sandboxId
        );


      if (sandbox) {
        const managed =
          sandbox.Config
            ?.Labels
            ?.["labplay.managed"];

        const containerAttemptId =
          sandbox.Config
            ?.Labels
            ?.["labplay.attemptId"];


        /*
          Dodatna zaštita:
          Runner neće slučajno obrisati
          container koji nije LabPlay-ov.
        */

        if (
          managed !== "true" ||
          String(
            containerAttemptId
          ) !==
            String(attemptId)
        ) {
          return res
            .status(409)
            .json({
              message:
                "Sandbox does not belong to this attempt",
            });
        }


        await docker([
          "rm",
          "-f",
          sandboxId,
        ]);
      }


      /* =========================
         2. VOLUME

         Volume možemo izračunati
         čak i ako container više
         ne postoji.
      ========================= */

      const volume =
        volumeName(
          attemptId
        );


      try {
        await docker([
          "volume",
          "inspect",
          volume,
        ]);


        await docker([
          "volume",
          "rm",
          volume,
        ]);

      } catch {
        /*
          Volume već ne postoji.

          To je OK.
          Cleanup je i dalje uspeo.
        */
      }


      console.log(
        `[runner] sandbox destroyed: ${sandboxId}`
      );


      res
        .status(204)
        .end();

    } catch (error) {
      next(error);
    }
  }
);
/* =========================================================
   ERROR HANDLER

   Detalj ostaje u Runner terminalu.
   Backend ne dobija stack trace.
========================================================= */

app.use(
  (error, req, res, _next) => {
    console.error(
      "[runner error]",
      error
    );

    const status =
      Number(
        error.statusCode
      ) || 500;


    res.status(status).json({
      message:
        status >= 500
          ? "Runner internal error"
          : error.message,
    });
  }
);

const server = http.createServer(app);

const terminalWss = new WebSocketServer({
  noServer: true,
  maxPayload: 64 * 1024,
});


function runnerWsAuthorized(req) {
  const header =
    req.headers.authorization || "";

  if (!header.startsWith("Bearer ")) {
    return false;
  }

  const token =
    header.slice("Bearer ".length);

  return token === RUNNER_API_TOKEN;
}


server.on(
  "upgrade",
  async (req, socket, head) => {
    try {
      const url =
        new URL(
          req.url,
          "http://runner.local"
        );

      const match =
        url.pathname.match(
          /^\/v1\/sandboxes\/([^/]+)\/terminal$/
        );

      if (!match) {
        socket.destroy();
        return;
      }

      /*
        Browser se NE povezuje
        direktno na Runner.

        Kasnije će Terminal Gateway
        poslati RUNNER_API_TOKEN.
      */
      if (!runnerWsAuthorized(req)) {
        socket.write(
          "HTTP/1.1 401 Unauthorized\r\n" +
          "Connection: close\r\n\r\n"
        );

        socket.destroy();
        return;
      }

      const sandboxId =
        decodeURIComponent(
          match[1]
        );

      const container =
        dockerApi.getContainer(
          sandboxId
        );

      const info =
        await container.inspect();

      const labels =
        info.Config?.Labels || {};

      if (
        labels["labplay.managed"] !==
        "true"
      ) {
        throw new Error(
          "Container is not managed by LabPlay"
        );
      }

      if (
        labels["labplay.profile"] !==
        "linux-basic"
      ) {
        throw new Error(
          "Terminal is only available for linux-basic sandboxes"
        );
      }

      if (!info.State?.Running) {
        throw new Error(
          "Sandbox is not running"
        );
      }

      req.sandboxId =
        sandboxId;

      terminalWss.handleUpgrade(
        req,
        socket,
        head,
        (ws) => {
          terminalWss.emit(
            "connection",
            ws,
            req
          );
        }
      );

    } catch (error) {
      console.error(
        "Terminal upgrade failed:",
        error.message
      );

      socket.write(
        "HTTP/1.1 400 Bad Request\r\n" +
        "Connection: close\r\n\r\n"
      );

      socket.destroy();
    }
  }
);

terminalWss.on(
  "connection",
  async (ws, req) => {
    let terminalStream = null;

    try {
      const container =
        dockerApi.getContainer(
          req.sandboxId
        );

      /*
        Isto kao kada bismo ručno uradili:

        docker exec -it \
          --user bob \
          <container> \
          /bin/bash
      */

      const exec =
        await container.exec({
          Cmd: [
            "/bin/bash",
            "-l",
          ],

          AttachStdin: true,
          AttachStdout: true,
          AttachStderr: true,

          Tty: true,

          User: "bob",

          WorkingDir:
            "/home/bob",

          Env: [
            "TERM=xterm-256color",
            "HOME=/home/bob",
            "USER=bob",
            "SHELL=/bin/bash",
          ],
        });


      terminalStream =
        await exec.start({
          hijack: true,
          stdin: true,
          Tty: true,
        });


      /*
        Docker → browser/gateway
      */

      terminalStream.on(
        "data",
        (chunk) => {
          if (
            ws.readyState ===
            ws.OPEN
          ) {
            ws.send(
              chunk,
              {
                binary: true,
              }
            );
          }
        }
      );


      /*
        browser/gateway → Docker bash
      */

      ws.on(
        "message",
        (data) => {
          if (
            terminalStream &&
            !terminalStream.destroyed
          ) {
            terminalStream.write(
              data
            );
          }
        }
      );


      terminalStream.on(
        "end",
        () => {
          if (
            ws.readyState ===
            ws.OPEN
          ) {
            ws.close();
          }
        }
      );


      terminalStream.on(
        "error",
        (error) => {
          console.error(
            "Docker terminal stream error:",
            error.message
          );

          ws.close();
        }
      );


      ws.on(
        "close",
        () => {
          if (
            terminalStream &&
            !terminalStream.destroyed
          ) {
            terminalStream.end();
          }
        }
      );

    } catch (error) {
      console.error(
        "Terminal session failed:",
        error
      );

      if (
        ws.readyState ===
        ws.OPEN
      ) {
        ws.close(
          1011,
          "Terminal unavailable"
        );
      }
    }
  }
);
/* =========================================================
   START
========================================================= */

async function start() {
  /*
    Odmah proveravamo da Docker
    stvarno radi.
  */
  try {
    const { stdout } =
      await docker([
        "info",
        "--format",
        "{{.ServerVersion}}",
      ]);

    console.log(
      `Docker server: ${stdout.trim()}`
    );

  } catch (error) {
    console.error(
      "Docker nije dostupan."
    );

    console.error(
      "Pokreni Docker Desktop pa ponovo pokreni Runner."
    );

    process.exit(1);
  }


  /*
    Povučemo image ako ga nema.
  */
  try {
    await docker([
      "image",
      "inspect",
      RUNNER_IMAGE,
    ]);
  } catch {
    console.log(
      `Downloading ${RUNNER_IMAGE}...`
    );

    await docker([
      "pull",
      RUNNER_IMAGE,
    ]);
  }


  server.listen(
    PORT,
    () => {
      console.log(
        `LabPlay Runner listening on http://localhost:${PORT}`
      );

      console.log(
        `Runner image: ${RUNNER_IMAGE}`
      );
    }
  );
}


start();