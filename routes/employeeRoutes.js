import express from "express";
import multer from "multer";
import multerS3 from "multer-s3";

import s3 from "../confirg/s3.js";

import {
    createEmployee,
    getDashboardDetails,
    getEmployees,
    getLastTargetTracker,
    getLastTwoEmployees,
    loginUser,
    updateAchievedValue
} from "../controllers/employeeController.js";

const router = express.Router();

const upload = multer({
    storage: multerS3({
        s3: s3,
        bucket: process.env.S3_BUCKET_NAME,

        metadata: function (req, file, cb) {
            cb(null, { fieldName: file.fieldname });
        },

        key: function (req, file, cb) {
            cb(null, `employee/${Date.now()}-${file.originalname}`);
        },
    }),
});

router.post(
    "/employee",
    upload.single("empimage"),
    createEmployee
);

router.get("/employees", getEmployees);

router.post("/update-achieved", updateAchievedValue);

router.get("/dashboard-details", getDashboardDetails);

router.get("/getlastdata", getLastTargetTracker);

router.get("/getLastTwoEmployees", getLastTwoEmployees);
router.post("/login", loginUser);

export default router;