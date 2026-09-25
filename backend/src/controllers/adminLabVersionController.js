import {
  createDraftVersion,
} from "../services/adminLabVersionService.js";


export async function createVersion(
  req,
  res,
  next
) {
  try {
    const lab =
      await createDraftVersion(
        req.params.labId
      );


    res.status(201).json({
      lab,
    });

  } catch (error) {
    next(error);
  }
}