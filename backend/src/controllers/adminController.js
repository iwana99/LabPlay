import bcrypt from "bcryptjs";
import mongoose from "mongoose";

import AdminUser
  from "../models/AdminUser.js";

import Lab
  from "../models/Lab.js";

import Task
  from "../models/Task.js";

import {
  ADMIN_COOKIE_NAME,
  adminCookieOptions,
  createAdminSession,
} from "../security/adminSession.js";


/* ========================================
   AUTH
======================================== */

export async function login(
  req,
  res,
  next
) {
  try {
    const email =
      req.body.email
        .trim()
        .toLowerCase();

    const admin =
      await AdminUser.findOne({
        email,
        isActive: true,
      }).select("+passwordHash");

    if (!admin) {
      return res.status(401).json({
        message:
          "Pogrešan email ili lozinka.",
      });
    }

    const passwordCorrect =
      await bcrypt.compare(
        req.body.password,
        admin.passwordHash
      );

    if (!passwordCorrect) {
      return res.status(401).json({
        message:
          "Pogrešan email ili lozinka.",
      });
    }

    const token =
      await createAdminSession(
        admin
      );

    res.cookie(
      ADMIN_COOKIE_NAME,
      token,
      adminCookieOptions()
    );

    admin.lastLoginAt =
      new Date();

    await admin.save();

    res.json({
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
    });
  } catch (error) {
    next(error);
  }
}


export async function logout(
  _req,
  res
) {
  const options =
    adminCookieOptions();

  res.clearCookie(
    ADMIN_COOKIE_NAME,
    {
      httpOnly:
        options.httpOnly,

      secure:
        options.secure,

      sameSite:
        options.sameSite,

      path:
        options.path,
    }
  );

  res.status(204).end();
}


export async function me(
  req,
  res
) {
  res.json({
    admin: req.admin,
  });
}


/* ========================================
   LABS
======================================== */

export async function listLabs(
  _req,
  res,
  next
) {
  try {
    const labs =
      await Lab.find()
        .sort({
          createdAt: -1,
        })
        .lean();

    res.json({
      labs,
    });
  } catch (error) {
    next(error);
  }
}


export async function createLab(
  req,
  res,
  next
) {
  try {
    const slug =
      req.body.slug
        .trim()
        .toLowerCase();

    /*
      Ako već postoji Lab sa tim slug-om,
      pravimo novu verziju.
    */
    const previous =
      await Lab.findOne({
        slug,
      }).sort({
        version: -1,
      });

    const version =
      previous
        ? previous.version + 1
        : 1;

    const lab =
      await Lab.create({
        slug,

        title:
          req.body.title.trim(),

        track:
          req.body.track,

        version,

        sandboxProfile:
          req.body.sandboxProfile,

        status: "draft",
      });

    res
      .status(201)
      .json({
        lab,
      });

  } catch (error) {
    next(error);
  }
}


export async function getLab(
  req,
  res,
  next
) {
  try {
    const { labId } =
      req.params;

    if (
      !mongoose.isValidObjectId(
        labId
      )
    ) {
      return res
        .status(400)
        .json({
          message:
            "Invalid lab id",
        });
    }

    const lab =
      await Lab.findById(
        labId
      ).lean();

    if (!lab) {
      return res
        .status(404)
        .json({
          message:
            "Lab nije pronađen.",
        });
    }

    /*
      checker je select:false
      u Task modelu.

      Admin SME da ga vidi.
      Student NE SME.
    */
    const tasks =
      await Task.find({
        labId,
      })
        .select("+checker")
        .sort({
          order: 1,
        })
        .lean();

    res.json({
      lab,
      tasks,
    });

  } catch (error) {
    next(error);
  }
}


/* ========================================
   TASKS
======================================== */

export async function createTask(
  req,
  res,
  next
) {
  try {
    const { labId } =
      req.params;

    if (
      !mongoose.isValidObjectId(
        labId
      )
    ) {
      return res
        .status(400)
        .json({
          message:
            "Invalid lab id",
        });
    }

    const lab =
      await Lab.findById(
        labId
      );

    if (!lab) {
      return res
        .status(404)
        .json({
          message:
            "Lab nije pronađen.",
        });
    }

    /*
      Objavljen Lab više ne menjamo.

      Ako želimo izmene,
      pravimo novu Lab verziju.
    */
    if (
      lab.status !== "draft"
    ) {
      return res
        .status(409)
        .json({
          message:
            "Zadaci mogu da se dodaju samo u draft Lab.",
        });
    }

    const lastTask =
      await Task.findOne({
        labId,
      })
        .sort({
          order: -1,
        })
        .select("order");

    const nextOrder =
      lastTask
        ? lastTask.order + 1
        : 1;

    const task =
      await Task.create({
        labId,

        order:
          nextOrder,

        title:
          req.body.title,

        instructions:
          req.body.instructions,

        taskType:
          req.body.taskType,

        starterFiles:
          req.body.starterFiles,

        language:
          req.body.language,

        hints:
          req.body.hints,

        checker:
          req.body.checker,

        resourceLimits:
          req.body.resourceLimits,
      });

    /*
      Task model inače skriva
      checker kada ga čitamo,
      ali ovde upravo kreiran
      objekat možemo vratiti
      Admin UI-ju.
    */
    res
      .status(201)
      .json({
        task,
      });

  } catch (error) {
    next(error);
  }
}

export async function updateTask(
  req,
  res,
  next
) {
  try {
    const {
      labId,
      taskId,
    } = req.params;


    /* =========================
       1. PRONAĐI LAB
    ========================= */

    const lab =
      await Lab.findById(
        labId
      );

    if (!lab) {
      return res
        .status(404)
        .json({
          message:
            "Lab nije pronađen.",
        });
    }


    /* =========================
       2. SAMO DRAFT SME DA SE MENJA
    ========================= */

    if (
      lab.status !== "draft"
    ) {
      return res
        .status(409)
        .json({
          message:
            "Objavljena verzija laba ne može da se menja. Napravi novu draft verziju.",
        });
    }


    /* =========================
       3. PRONAĐI TASK
    ========================= */

    const task =
      await Task.findOne({
        _id:
          taskId,

        labId:
          lab._id,
      }).select(
        "+checker"
      );


    if (!task) {
      return res
        .status(404)
        .json({
          message:
            "Zadatak nije pronađen.",
        });
    }


    /* =========================
       4. UPIŠI NOVE VREDNOSTI
    ========================= */

    task.title =
      req.body.title;

    task.instructions =
      req.body.instructions;

    task.taskType =
      req.body.taskType;

    task.starterFiles =
      req.body.starterFiles;

    task.language =
      req.body.language;

    task.hints =
      req.body.hints;

    task.checker =
      req.body.checker;

    task.resourceLimits =
      req.body.resourceLimits;


    await task.save();


    /* =========================
       5. VRATI IZMENJEN TASK
    ========================= */

    res.json({
      task,
    });

  } catch (error) {
    next(error);
  }
}
/* ========================================
   PUBLISH
======================================== */

export async function publishLab(
  req,
  res,
  next
) {
  try {
    const { labId } =
      req.params;

    if (
      !mongoose.isValidObjectId(
        labId
      )
    ) {
      return res
        .status(400)
        .json({
          message:
            "Invalid lab id",
        });
    }

    const lab =
      await Lab.findById(
        labId
      );

    if (!lab) {
      return res
        .status(404)
        .json({
          message:
            "Lab nije pronađen.",
        });
    }

    if (
      lab.status !== "draft"
    ) {
      return res
        .status(409)
        .json({
          message:
            "Samo draft Lab može da se objavi.",
        });
    }

    const tasks =
  await Task.find({
    labId: lab.id,
  })
    .sort({
      order: 1,
    })
    .select("+checker");

    if (!tasks.length) {
      return res
        .status(409)
        .json({
          message:
            "Lab mora imati bar jedan zadatak.",
        });
    }

    /*
      Trenutni Runner koji smo
      napravile podržava CODE
      + node-basic.

      Linux taskove Admin može
      već sada da čuva kao draft,
      ali ih još ne objavljujemo
      dok ne napravimo Linux Runner.
    */
   
const nodeLabValid =
  lab.sandboxProfile === "node-basic" &&
  tasks.every(
    (task) =>
      task.taskType === "code"
  );

const linuxLabValid =
  lab.sandboxProfile === "linux-basic" &&
  tasks.every(
    (task) =>
      task.taskType === "linux_state"
  );

if (
  !nodeLabValid &&
  !linuxLabValid
) {
  return res
    .status(409)
    .json({
      message:
        "Lab i tipovi zadataka nisu kompatibilni sa sandbox profilom.",
    });
}
    

    /*
      Proveravamo da nema:

      1, 2, 4

      umesto:

      1, 2, 3
    */
    const correctOrder =
      tasks.every(
        (task, index) =>
          task.order ===
          index + 1
      );

    if (!correctOrder) {
      return res
        .status(409)
        .json({
          message:
            "Redosled zadataka nije ispravan.",
        });
    }

    /*
      Ako postoji prethodna
      published verzija istog Lab-a,
      arhiviramo je.

      Existing Attempt i dalje
      ostaje vezan za svoju verziju.
    */
    await Lab.updateMany(
      {
        slug: lab.slug,
        _id: {
          $ne: lab._id,
        },
        status:
          "published",
      },
      {
        $set: {
          status:
            "archived",
        },
      }
    );

    lab.status =
      "published";

    lab.publishedAt =
      new Date();

    await lab.save();

    res.json({
      lab,
    });

  } catch (error) {
    next(error);
  }
}

export async function deleteTask(
  req,
  res,
  next
) {
  const session =
    await mongoose.startSession();

  try {
    await session.withTransaction(
      async () => {
        const {
          labId,
          taskId,
        } = req.params;


        /* =========================
           1. PRONAĐI LAB
        ========================= */

        const lab =
          await Lab.findById(
            labId
          ).session(session);

        if (!lab) {
          throw Object.assign(
            new Error(
              "Lab nije pronađen."
            ),
            {
              statusCode: 404,
            }
          );
        }


        /* =========================
           2. SAMO DRAFT SME
           DA SE MENJA
        ========================= */

        if (
          lab.status !==
          "draft"
        ) {
          throw Object.assign(
            new Error(
              "Objavljena verzija laba ne može da se menja."
            ),
            {
              statusCode: 409,
            }
          );
        }


        /* =========================
           3. PRONAĐI TASK
        ========================= */

        const task =
          await Task.findOne({
            _id: taskId,
            labId:
              lab._id,
          }).session(session);

        if (!task) {
          throw Object.assign(
            new Error(
              "Zadatak nije pronađen."
            ),
            {
              statusCode: 404,
            }
          );
        }


        const deletedOrder =
          task.order;


        /* =========================
           4. OBRIŠI TASK
        ========================= */

        await Task.deleteOne(
          {
            _id:
              task._id,
          },
          {
            session,
          }
        );


        /* =========================
           5. POMERI SVE POSLE NJEGA

           1 2 3 4
             X
           ↓
           1 2 3
        ========================= */

        const laterTasks =
          await Task.find({
            labId:
              lab._id,

            order: {
              $gt:
                deletedOrder,
            },
          })
            .sort({
              order: 1,
            })
            .session(session);


        for (
          const laterTask
          of laterTasks
        ) {
          await Task.updateOne(
            {
              _id:
                laterTask._id,
            },
            {
              $set: {
                order:
                  laterTask.order -
                  1,
              },
            },
            {
              session,
            }
          );
        }
      }
    );


    res.status(204).end();

  } catch (error) {
    next(error);

  } finally {
    await session.endSession();
  }
}