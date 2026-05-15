import db from "../confirg/db.js";
import jwt from "jsonwebtoken";

export const createEmployee = async (req, res) => {

    try {

        console.log("API HIT");

        const {
            name,
            empid,
            projectname,
            value,
            type
        } = req.body;

        console.log("BODY:", req.body);

        // Upload Image
        const empimage = req.file
            ? req.file.location
            : null;

        // Convert entered value
        let enteredValue = parseFloat(value) || 0;

        // Convert Lakhs -> Crores
        if (type === "lakhs") {

            enteredValue = enteredValue / 100;

        }

        console.log("ENTERED VALUE:", enteredValue);

        // Insert Employee Details
        await db.promise().execute(
            `
            INSERT INTO employeedetails
            (name, empid, projectname, value, empimage)
            VALUES (?, ?, ?, ?, ?)
            `,
            [
                name,
                empid,
                projectname,
                enteredValue,
                empimage
            ]
        );

        console.log("EMPLOYEE INSERTED");

        // Get Latest Achieved Value
        const [lastRow] = await db.promise().execute(`
            SELECT achieved
            FROM target_tracker
            ORDER BY id DESC
            LIMIT 1
        `);

        console.log("LAST ROW:", lastRow);

        // Default Initial Achieved
        let currentAmount = 8700.00;

        // If rows exist take latest achieved
        if (lastRow.length > 0) {

            currentAmount =
                parseFloat(lastRow[0].achieved) || 8700.00;

        }

        console.log("CURRENT AMOUNT:", currentAmount);

        // Add New Value
        const newAchieved =
            currentAmount + enteredValue;

        console.log("NEW ACHIEVED:", newAchieved);

        // Store Tracker Data
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

        console.log("TRACKER INSERTED");

        return res.status(200).json({
            success: true,
            message: "Employee created successfully",
            currentAmount,
            addedAmount: enteredValue,
            achieved: newAchieved,
            imageUrl: empimage
        });

    } catch (error) {

        console.log("ERROR:", error);

        return res.status(500).json({
            success: false,
            error: error.message
        });

    }

};


export const getDashboardDetails = async (req, res) => {

    try {

        // Fixed Target
        const target = 10400;

        // Get Latest Achieved Value
        const [rows] = await db.promise().execute(`
            SELECT achieved
            FROM target_tracker
            ORDER BY id DESC
            LIMIT 1
        `);

        let achieved = 8700.00;

        if (rows.length > 0) {

            achieved =
                parseFloat(rows[0].achieved) || 8700.00;

        }

        // Pending Amount
        const pending = target - achieved;

        return res.status(200).json({
            success: true,
            target,
            achieved,
            pending
        });

    } catch (error) {

        console.log(error);

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
            LIMIT 2
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

