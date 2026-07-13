import db from "../confirg/db.js";
import jwt from "jsonwebtoken";
import multer from "multer";
import s3 from "../confirg/s3.js";

import XLSX from "xlsx";
import fs from "fs";
import AdmZip from "adm-zip";
import path from "path";

import { Upload } from "@aws-sdk/lib-storage";

export const uploadBulkEmployees = async (req, res) => {

  try {

    // ZIP File
    const zipFile = req.file;

    if (!zipFile) {

      return res.status(400).json({
        success: false,
        message: "ZIP file required"
      });
    }

    // Create Extract Folder
    const extractPath =
      `uploads/extracted_${Date.now()}`;

    fs.mkdirSync(extractPath, {
      recursive: true
    });

    // Extract ZIP
    const zip = new AdmZip(zipFile.path);

    zip.extractAllTo(extractPath, true);

    // Read Extracted Files
    const files =
      fs.readdirSync(extractPath);

    // Find Excel File
    const excelName = files.find(
      (file) =>
        file.endsWith(".xlsx") ||
        file.endsWith(".xls")
    );

    if (!excelName) {

      return res.status(400).json({
        success: false,
        message:
          "Excel file not found inside ZIP"
      });
    }

    // Excel Full Path
    const excelPath = path.join(
      extractPath,
      excelName
    );

    // Read Excel
    const workbook =
      XLSX.readFile(excelPath);

    const sheetName =
      workbook.SheetNames[0];

    const sheetData =
      XLSX.utils.sheet_to_json(
        workbook.Sheets[sheetName]
      );

    // Images Folder Path
    const imageFolder = path.join(
      extractPath,
      "images"
    );

    // Read Images
    const imageFiles =
      fs.existsSync(imageFolder)
        ? fs.readdirSync(imageFolder)
        : [];

    // Store Uploaded Image URLs
    const imageMap = {};

    // Upload Images To S3
    for (const image of imageFiles) {

      // Example:
      // CTS1001.png -> CTS1001
      const empId =
        image.split(".")[0];

      // Image Path
      const imagePath = path.join(
        imageFolder,
        image
      );

      // Read Image
      const fileContent =
        fs.readFileSync(imagePath);

      // Upload To S3
      const upload = new Upload({
        client: s3,

        params: {
          Bucket:
            process.env.S3_BUCKET_NAME,

          Key:
            `employee/${Date.now()}-${image}`,

          Body: fileContent,

          ContentType: "image/png"
        }
      });

      const uploadResult =
        await upload.done();

      // Save S3 URL
      imageMap[empId] =
        uploadResult.Location;
    }

    // Insert Employee Data
// Insert Employee Data
for (const row of sheetData) {

  // Check Existing EmpID
  const [existingUser] =
    await db.promise().query(
      `
      SELECT empid
      FROM users_details
      WHERE empid = ?
      `,
      [row.empid]
    );

  // If Already Exists
  if (existingUser.length > 0) {

    return res.status(400).json({
      success: false,
      message:
        `Employee ID ${row.empid} already exists`
    });
  }

  // Match Image Using empid
  const imageUrl =
    imageMap[row.empid] || null;

  // Insert Into DB
  await db.promise().query(
    `
    INSERT INTO users_details
    (
      name,
      empid,
      empimg
    )
    VALUES (?, ?, ?)
    `,
    [
      row.name,
      row.empid,
      imageUrl
    ]
  );
}

    // Delete ZIP File
    fs.unlinkSync(zipFile.path);

    return res.status(200).json({
      success: true,
      message:
        "Bulk employees uploaded successfully"
    });

  } catch (error) {

    console.log(error);

    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const createEmployee = async (req, res) => {
    try {
        console.log("========== CREATE EMPLOYEE ==========");

        console.log("BODY :", req.body);
        console.log("FILE :", req.file);

        const {
            name,
            empid,
            projectname,
            value
        } = req.body;

        // Validate required fields
        if (!name || !empid || !projectname || !value) {
            return res.status(400).json({
                success: false,
                message: "name, empid, projectname and value are required"
            });
        }

        // Employee Image
        const empimage = req.file ? req.file.location : null;

        // Convert value to number
        const enteredValue = Number(value);

        if (isNaN(enteredValue)) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid value"
            });
        }


        console.log("INSERT DATA :", {
            name,
            empid,
            projectname,
            enteredValue,
            empimage
        });


        // Insert Employee
        await db.promise().execute(
            `
            INSERT INTO employeedetails
            (
                name,
                empid,
                projectname,
                value,
                empimage
            )
            VALUES (?, ?, ?, ?, ?)
            `,
            [
                name ?? null,
                empid ?? null,
                projectname ?? null,
                enteredValue ?? null,
                empimage ?? null
            ]
        );


        // Fetch latest achieved value
        const [trackerRows] = await db.promise().execute(
            `
            SELECT achieved
            FROM target_tracker
            ORDER BY id DESC
            LIMIT 1
            `
        );


        // Default starting amount
        let currentAmount = 1512;


        if (
            trackerRows.length > 0 &&
            trackerRows[0].achieved !== null
        ) {
            currentAmount = Number(trackerRows[0].achieved);
        }


        // Calculate new achieved
        const newAchieved = currentAmount + enteredValue;


        console.log("TARGET UPDATE :", {
            currentAmount,
            addedAmount: enteredValue,
            achieved: newAchieved
        });


        // Insert tracker history
        await db.promise().execute(
            `
            INSERT INTO target_tracker
            (
                current_amount,
                added_amount,
                achieved
            )
            VALUES (?, ?, ?)
            `,
            [
                currentAmount,
                enteredValue,
                newAchieved
            ]
        );


        return res.status(200).json({
            success: true,
            message: "Employee created successfully",
            data: {
                name,
                empid,
                projectname,
                value: enteredValue,
                imageUrl: empimage
            },
            tracker: {
                currentAmount,
                addedAmount: enteredValue,
                achieved: newAchieved
            }
        });


    } catch (error) {

        console.log("CREATE EMPLOYEE ERROR :", error);

        return res.status(500).json({
            success: false,
            message: "Failed to create employee",
            error: error.message
        });

    }
};

export const getDashboardDetails = async (req, res) => {
    try {

        const target = 9500;

        const [rows] = await db.promise().execute(`
            SELECT current_amount, added_amount, achieved
            FROM target_tracker
            ORDER BY id DESC
            LIMIT 1
        `);

        let achieved = 1512;
        let currentAmount = 1512;
        let addedAmount = 0;

        if (rows.length > 0) {
            currentAmount = Number(rows[0].current_amount);
            addedAmount = Number(rows[0].added_amount);
            achieved = Number(rows[0].achieved);
        }

        const pending = target - achieved;

        return res.status(200).json({
            success: true,
            target,
            currentAmount,
            addedAmount,
            achieved,
            pending
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

export const getEmployees = async (req, res) => {

    try {

        const sql = `
            SELECT * 
            FROM employeedetails
            ORDER BY id DESC
        `;

        const [rows] = await db.promise().execute(sql);

        return res.status(200).json({
            success: true,
            count: rows.length,
            data: rows
        });

    } catch (error) {

        console.log("GET API ERROR:", error);

        return res.status(500).json({
            success: false,
            error: error.message
        });

    }

};


export const updateAchievedValue = async (req, res) => {

    try {

        const { value } = req.body;

        // Get last achieved value
        const [lastRow] = await db.promise().execute(`
            SELECT achieved
            FROM target_tracker
            ORDER BY id DESC
            LIMIT 1
        `);

        const lastAchieved = Number(lastRow[0].achieved) || 8700.00;

        // Add new value
        const newAchieved = lastAchieved + Number(value);

        // Insert new achieved amount
        await db.promise().execute(
            `
            INSERT INTO target_tracker (achieved)
            VALUES (?)
            `,
            [newAchieved]
        );

        return res.status(200).json({
            success: true,
            achieved: newAchieved
        });

    } catch (error) {

        console.log(error);

        return res.status(500).json({
            success: false,
            error: error.message
        });

    }

};


export const getLastTargetTracker = async (req, res) => {

    try {

        const [rows] = await db.promise().execute(`
            SELECT * 
            FROM target_tracker
            ORDER BY id DESC
            LIMIT 1
        `);

        if (rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "No data found"
            });

        }

        return res.status(200).json({
            success: true,
            data: rows[0]
        });

    } catch (error) {

        console.log("GET LAST TARGET TRACKER ERROR:", error);

        return res.status(500).json({
            success: false,
            error: error.message
        });

    }

};

export const getLastTwoEmployees = async (req, res) => {

    try {

        const [rows] = await db.promise().execute(`
            SELECT *
            FROM employeedetails
            ORDER BY id DESC
            LIMIT 1
        `);

        if (rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "No employee data found"
            });

        }

        return res.status(200).json({
            success: true,
            data: rows
        });

    } catch (error) {

        console.log("GET LAST TWO EMPLOYEES ERROR:", error);

        return res.status(500).json({
            success: false,
            error: error.message
        });

    }

};

export const getTargetProgress = async (req, res) => {
    try {

        const TARGET = 9500;

        // Fetch the latest achieved value
        const [rows] = await db.promise().execute(`
            SELECT achieved
            FROM target_tracker
            ORDER BY id DESC
            LIMIT 1
        `);

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No target tracker data found."
            });
        }

        // Dynamic achieved value from the last row
        const achieved = Number(rows[0].achieved);

        // Calculate pending
        const pending = TARGET - achieved;

        // Calculate percentage
        const percentage = Number(
            ((achieved / TARGET) * 100).toFixed(2)
        );

        return res.status(200).json({
            success: true,
            target: TARGET,
            achieved,
            pending,
            percentage
        });

    } catch (error) {

        console.log(error);

        return res.status(500).json({
            success: false,
            error: error.message
        });

    }
};

export const loginUser = async (req, res) => {

    try {

        const { emailid, password } = req.body;

        // Validation
        if (!emailid || !password) {

            return res.status(400).json({
                success: false,
                message: "Email and Password are required"
            });

        }

        // Check User
        const [rows] = await db.promise().execute(
            `
            SELECT *
            FROM userregisteration
            WHERE emailid = ?
            `,
            [emailid]
        );

        if (rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "User not found"
            });

        }

        const user = rows[0];

        // Password Check
        if (password !== user.password) {

            return res.status(401).json({
                success: false,
                message: "Invalid Password"
            });

        }

        // Update Last Login Date Time
        await db.promise().execute(
            `
            UPDATE userregisteration
            SET lastlogindatetime = NOW()
            WHERE id = ?
            `,
            [user.id]
        );

        // Token Generate
        const token = jwt.sign(
            {
                id: user.id,
                emailid: user.emailid
            },
            "SECRETKEY",
            {
                expiresIn: "1d"
            }
        );

        return res.status(200).json({
            success: true,
            message: "Login Successful",
            token,
            user: {
                id: user.id,
                emailid: user.emailid,
                lastlogindatetime: new Date()
            }
        });

    } catch (error) {

        console.log("LOGIN ERROR:", error);

        return res.status(500).json({
            success: false,
            error: error.message
        });

    }

};

export const getEmployeeByEmpId = async (req, res) => {

  try {

    const { empid } = req.params;

    if (!empid) {

      return res.status(400).json({
        success: false,
        message: "EmpID is required"
      });
    }

    // Fetch Employee
    const [employee] =
      await db.promise().query(
        `
        SELECT
          name,
          empid,
          empimg
        FROM users_details
        WHERE empid = ?
        `,
        [empid]
      );

    // Employee Not Found
    if (employee.length === 0) {

      return res.status(404).json({
        success: false,
        message: "Employee not found"
      });
    }

    // Success Response
    return res.status(200).json({
      success: true,
      data: employee[0]
    });

  } catch (error) {

    console.log(error);

    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

