import express from "express";
import multer from "multer";
import multerS3 from "multer-s3";
import s3 from "../confirg/s3.js";

import {
    createEmployee,
    getDashboardDetails,
    getEmployeeByEmpId,
    getEmployees,
    getLastTargetTracker,
    getLastTwoEmployees,
    getTargetProgress,
    loginUser,
    updateAchievedValue,
    uploadBulkEmployees
} from "../controllers/employeeController.js";

const router = express.Router();

// Local Upload For Excel
const upload = multer({
    dest: "uploads/",
});

// Existing APIs
router.post(
    "/employee",
    upload.single("empimage"),
    createEmployee
);

router.get("/employees", getEmployees);

router.post("/update-achieved", updateAchievedValue);

router.get("/dashboard-details", getDashboardDetails);

router.get("/getlastdata", getLastTargetTracker);
router.get("/gettargettracker", getTargetProgress);

router.get("/getLastTwoEmployees", getLastTwoEmployees);

router.post("/login", loginUser);

router.post(
    "/upload-bulk-employees",
    upload.single("zipFile"),
    uploadBulkEmployees
);

router.get(
  "/employee/:empid",
  getEmployeeByEmpId
);

export default router;