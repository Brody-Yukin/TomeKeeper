import { Router, type IRouter } from "express";
import booksRouter from "./books";
import healthRouter from "./health";
import libraryRouter from "./library";

const router: IRouter = Router();

router.use(healthRouter);
router.use(booksRouter);
router.use(libraryRouter);

export default router;
