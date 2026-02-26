const { 
  FeeStructure, StudentFee, ClassStudent, FeePayment,
  User, Class 
} = require("./models");
const bcrypt = require("bcryptjs");

/* FEE STRUCTURE MANAGEMENT */

/* Create Fee Structure for a Class */

const createFeeStructure = async (req, res) => {
  try {
    const { classId, tuitionFee, examFee, miscFee } = req.body;

    // Validate required fields
    if (!classId || tuitionFee == null) {
      return res.status(400).json({ message: "Required fields missing" });
    }

    // Calculate total fee
    const totalFee =
      Number(tuitionFee) + Number(examFee || 0) + Number(miscFee || 0);

    // Create fee structure
    const fee = await FeeStructure.create({
      classId,
      tuitionFee,
      examFee: examFee || 0,
      miscFee: miscFee || 0,
      totalFee,
      createdBy: req.user.id
    });

    res.status(201).json({
      message: "Fee structure created successfully",
      fee
    });
  } catch (error) {
    // Handle duplicate fee structure for same class
    if (error.code === 11000) {
      return res.status(400).json({
        message: "Fee structure already exists for this class"
      });
    }
    res.status(500).json({ message: "Server error" });
  }
};

/* Get All Fee Structures*/
const getFeeStructures = async (req, res) => {
  try {
    const { classId, isActive } = req.query;
    
    // Build filter object
    let filter = {};
    if (classId) filter.classId = classId;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    // Fetch fee structures with class details
    const fees = await FeeStructure.find(filter)
      .populate("classId", "className section")
      .sort({ createdAt: -1 });

    res.json({
      total: fees.length,
      fees
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

/* Update Fee Structure */
const updateFeeStructure = async (req, res) => {
  try {
    const { id } = req.params;
    const { tuitionFee, examFee, miscFee, isActive } = req.body;

    // Find existing fee structure
    const feeStructure = await FeeStructure.findById(id);
    if (!feeStructure) {
      return res.status(404).json({ message: "Fee structure not found" });
    }

    // Update fields if provided
    if (tuitionFee !== undefined) feeStructure.tuitionFee = tuitionFee;
    if (examFee !== undefined) feeStructure.examFee = examFee;
    if (miscFee !== undefined) feeStructure.miscFee = miscFee;
    if (isActive !== undefined) feeStructure.isActive = isActive;

    // Recalculate total fee
    feeStructure.totalFee = 
      feeStructure.tuitionFee + 
      feeStructure.examFee + 
      feeStructure.miscFee;

    await feeStructure.save();

    res.json({
      message: "Fee structure updated successfully",
      fee: feeStructure
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

/* Delete Fee Structure (Soft Delete) */
const deleteFeeStructure = async (req, res) => {
  try {
    const { id } = req.params;

    const feeStructure = await FeeStructure.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );

    if (!feeStructure) {
      return res.status(404).json({ message: "Fee structure not found" });
    }

    res.json({
      message: "Fee structure deactivated successfully"
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

/*  STUDENT FEE MANAGEMENT */

/* Assign Fee to Student */
const assignFeeToStudent = async (req, res) => {
  try {
    const { studentId, classId } = req.body;

    // Verify student is in this class
    const mapping = await ClassStudent.findOne({
      studentId,
      classId,
      isActive: true
    });

    if (!mapping) {
      return res.status(400).json({
        message: "Student not assigned to this class"
      });
    }

    // Get active fee structure for class
    const feeStructure = await FeeStructure.findOne({
      classId,
      isActive: true
    });

    if (!feeStructure) {
      return res.status(404).json({
        message: "Fee structure not found for class"
      });
    }

    // Create student fee record
    const fee = await StudentFee.create({
      studentId,
      classId,
      totalFee: feeStructure.totalFee,
      dueAmount: feeStructure.totalFee,
      paidAmount: 0,
      status: "unpaid",
      createdBy: req.user.id
    });

    // Populate student details for response
    await fee.populate("studentId", "name email rollNo admissionNo");
    await fee.populate("classId", "className section");

    res.status(201).json({
      message: "Fee assigned to student successfully",
      fee
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        message: "Fee already assigned to this student"
      });
    }
    res.status(500).json({ message: "Server error" });
  }
};

/* Get All Student Fees */
const getStudentFees = async (req, res) => {
  try {
    const { classId, status, studentId, search } = req.query;
    
    let filter = {};
    if (classId) filter.classId = classId;
    if (status) filter.status = status;
    if (studentId) filter.studentId = studentId;

    // Build query with population
    let query = StudentFee.find(filter)
      .populate("studentId", "name email rollNo admissionNo")
      .populate("classId", "className section")
      .sort({ createdAt: -1 });

    // If search term provided, filter by student name
    if (search) {
      const students = await User.find({
        role: "student",
        name: { $regex: search, $options: "i" }
      }).select("_id");
      
      const studentIds = students.map(s => s._id);
      filter.studentId = { $in: studentIds };
      query = StudentFee.find(filter)
        .populate("studentId", "name email rollNo admissionNo")
        .populate("classId", "className section")
        .sort({ createdAt: -1 });
    }

    const fees = await query;

    // Calculate summary statistics
    const summary = {
      totalFees: fees.length,
      totalCollected: fees.reduce((sum, f) => sum + f.paidAmount, 0),
      totalDue: fees.reduce((sum, f) => sum + f.dueAmount, 0),
      paid: fees.filter(f => f.status === "paid").length,
      partial: fees.filter(f => f.status === "partial").length,
      unpaid: fees.filter(f => f.status === "unpaid").length
    };

    res.json({
      summary,
      fees
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

/* Get Student Fee Details */
const getStudentFeeDetails = async (req, res) => {
  try {
    const { studentId } = req.params;

    // Get student fee record
    const studentFee = await StudentFee.findOne({ studentId })
      .populate("studentId", "name email rollNo admissionNo")
      .populate("classId", "className section");

    if (!studentFee) {
      return res.status(404).json({ message: "Fee record not found" });
    }

    // Get payment history
    const payments = await FeePayment.find({ 
      studentFeeId: studentFee._id 
    })
      .sort({ paymentDate: -1 });

    res.json({
      studentFee,
      payments,
      summary: {
        totalFee: studentFee.totalFee,
        paidAmount: studentFee.paidAmount,
        dueAmount: studentFee.dueAmount,
        status: studentFee.status
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

/*  PAYMENT MANAGEMENT  */

/* Receive Fee Payment */
const receiveFeePayment = async (req, res) => {
  try {
    const { studentFeeId, amountPaid, paymentMode } = req.body;

    // Validate input
    if (!studentFeeId || !amountPaid || !paymentMode) {
      return res.status(400).json({ 
        message: "Student fee ID, amount, and payment mode are required" 
      });
    }

    if (amountPaid <= 0) {
      return res.status(400).json({ 
        message: "Amount must be greater than 0" 
      });
    }

    // Find student fee record
    const studentFee = await StudentFee.findById(studentFeeId);
    if (!studentFee) {
      return res.status(404).json({ message: "Student fee record not found" });
    }

    // Check if amount exceeds due
    if (amountPaid > studentFee.dueAmount) {
      return res.status(400).json({ 
        message: `Amount cannot exceed due amount of ${studentFee.dueAmount}` 
      });
    }

    // Update student fee
    studentFee.paidAmount += amountPaid;
    studentFee.dueAmount -= amountPaid;

    // Update status
    if (studentFee.dueAmount <= 0) {
      studentFee.status = "paid";
      studentFee.dueAmount = 0;
    } else {
      studentFee.status = "partial";
    }

    await studentFee.save();

    // Create payment record
    const payment = await FeePayment.create({
      studentFeeId,
      amountPaid,
      paymentMode,
      createdBy: req.user.id
    });

    // Populate details for response
    await payment.populate({
      path: "studentFeeId",
      populate: [
        { path: "studentId", select: "name rollNo" },
        { path: "classId", select: "className section" }
      ]
    });

    res.json({
      message: "Payment recorded successfully",
      payment,
      updatedFee: {
        paidAmount: studentFee.paidAmount,
        dueAmount: studentFee.dueAmount,
        status: studentFee.status
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

/* Get Payment History */
const getPaymentHistory = async (req, res) => {
  try {
    const { 
      studentId, 
      classId, 
      paymentMode, 
      startDate, 
      endDate,
      page = 1,
      limit = 20 
    } = req.query;

    let filter = {};

    // Filter by date range
    if (startDate || endDate) {
      filter.paymentDate = {};
      if (startDate) filter.paymentDate.$gte = new Date(startDate);
      if (endDate) filter.paymentDate.$lte = new Date(endDate);
    }

    // Build query with population
    let query = FeePayment.find(filter)
      .populate({
        path: "studentFeeId",
        populate: [
          { path: "studentId", select: "name rollNo admissionNo" },
          { path: "classId", select: "className section" }
        ]
      })
      .sort({ paymentDate: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    // Apply additional filters
    if (paymentMode) {
      query = query.where("paymentMode").equals(paymentMode);
    }

    const payments = await query;
    const total = await FeePayment.countDocuments(filter);

    // Calculate totals
    const totalAmount = payments.reduce((sum, p) => sum + p.amountPaid, 0);

    res.json({
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      totalAmount,
      payments
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

/*  REPORTS AND STATISTICS  */

/* Get Fee Statistics for Dashboard */
const getFeeStatistics = async (req, res) => {
  try {
    // Get current date for monthly calculations
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfYear = new Date(today.getFullYear(), 0, 1);

    // Overall statistics
    const totalFees = await StudentFee.countDocuments();
    const paidFees = await StudentFee.countDocuments({ status: "paid" });
    const partialFees = await StudentFee.countDocuments({ status: "partial" });
    const unpaidFees = await StudentFee.countDocuments({ status: "unpaid" });

    // Amount statistics
    const allFees = await StudentFee.find();
    const totalCollected = allFees.reduce((sum, f) => sum + f.paidAmount, 0);
    const totalDue = allFees.reduce((sum, f) => sum + f.dueAmount, 0);
    const totalReceivable = allFees.reduce((sum, f) => sum + f.totalFee, 0);

    // Monthly collection
    const monthlyPayments = await FeePayment.find({
      paymentDate: { $gte: startOfMonth }
    });
    const monthlyCollection = monthlyPayments.reduce((sum, p) => sum + p.amountPaid, 0);

    // Yearly collection
    const yearlyPayments = await FeePayment.find({
      paymentDate: { $gte: startOfYear }
    });
    const yearlyCollection = yearlyPayments.reduce((sum, p) => sum + p.amountPaid, 0);

    // Recent payments (last 10)
    const recentPayments = await FeePayment.find()
      .populate({
        path: "studentFeeId",
        populate: { path: "studentId", select: "name" }
      })
      .sort({ paymentDate: -1 })
      .limit(10);

    // Class-wise collection
    const classWiseCollection = await StudentFee.aggregate([
      {
        $group: {
          _id: "$classId",
          totalFees: { $sum: "$totalFee" },
          collected: { $sum: "$paidAmount" },
          due: { $sum: "$dueAmount" },
          studentCount: { $sum: 1 }
        }
      },
      { $sort: { due: -1 } },
      { $limit: 5 }
    ]);

    await Class.populate(classWiseCollection, { 
      path: "_id", 
      select: "className section" 
    });

    res.json({
      overview: {
        totalStudents: totalFees,
        paidStudents: paidFees,
        partialStudents: partialFees,
        unpaidStudents: unpaidFees,
        collectionRate: totalReceivable ? 
          ((totalCollected / totalReceivable) * 100).toFixed(1) : 0
      },
      amounts: {
        totalCollected,
        totalDue,
        totalReceivable,
        monthlyCollection,
        yearlyCollection
      },
      recentPayments,
      classWise: classWiseCollection
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

/* Get Due Fees Report */
const getDueFees = async (req, res) => {
  try {
    const { days = 30 } = req.query;

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() - days);

    const dueFees = await StudentFee.find({
      status: { $in: ["unpaid", "partial"] },
      dueAmount: { $gt: 0 }
    })
      .populate("studentId", "name email rollNo admissionNo")
      .populate("classId", "className section")
      .sort({ dueAmount: -1 });

    const totalDue = dueFees.reduce((sum, f) => sum + f.dueAmount, 0);

    res.json({
      totalStudents: dueFees.length,
      totalDue,
      students: dueFees
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

/* Generate Fee Report */
const getFeeReport = async (req, res) => {
  try {
    const { classId, startDate, endDate, status } = req.query;

    let filter = {};
    if (classId) filter.classId = classId;
    if (status) filter.status = status;

    // Date filter for payments
    let paymentFilter = {};
    if (startDate || endDate) {
      paymentFilter.paymentDate = {};
      if (startDate) paymentFilter.paymentDate.$gte = new Date(startDate);
      if (endDate) paymentFilter.paymentDate.$lte = new Date(endDate);
    }

    const studentFees = await StudentFee.find(filter)
      .populate("studentId", "name rollNo admissionNo")
      .populate("classId", "className section");

    const report = await Promise.all(studentFees.map(async (fee) => {
      const payments = await FeePayment.find({
        studentFeeId: fee._id,
        ...paymentFilter
      }).sort({ paymentDate: -1 });

      return {
        student: fee.studentId,
        class: fee.classId,
        totalFee: fee.totalFee,
        paidAmount: fee.paidAmount,
        dueAmount: fee.dueAmount,
        status: fee.status,
        payments: payments.map(p => ({
          amount: p.amountPaid,
          mode: p.paymentMode,
          date: p.paymentDate
        }))
      };
    }));

    // Calculate totals
    const totals = {
      totalFees: report.reduce((sum, r) => sum + r.totalFee, 0),
      totalCollected: report.reduce((sum, r) => sum + r.paidAmount, 0),
      totalDue: report.reduce((sum, r) => sum + r.dueAmount, 0)
    };

    res.json({
      totals,
      report
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

/* PROFILE MANAGEMENT */

/* Get Accountant Profile */
const getAccountantProfile = async (req, res) => {
  try {
    const accountantId = req.user.id;
    
    const accountant = await User.findById(accountantId).select("-password");
    
    if (!accountant) {
      return res.status(404).json({ message: "Accountant not found" });
    }
    
    res.json({ user: accountant });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

/* Update Accountant Profile */
const updateAccountantProfile = async (req, res) => {
  try {
    const accountantId = req.user.id;
    const { name, gender, Dob } = req.body;
    
    const accountant = await User.findById(accountantId);
    
    if (!accountant) {
      return res.status(404).json({ message: "Accountant not found" });
    }
    
    if (name) accountant.name = name;
    if (gender) accountant.gender = gender;
    if (Dob) accountant.Dob = Dob;
    
    await accountant.save();
    
    res.json({ 
      message: "Profile updated successfully", 
      user: accountant 
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

/* Change Accountant Password */
const changeAccountantPassword = async (req, res) => {
  try {
    const accountantId = req.user.id;
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "All fields are required" });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ 
        message: "Password must be at least 6 characters" 
      });
    }
    
    const accountant = await User.findById(accountantId);
    
    if (!accountant) {
      return res.status(404).json({ message: "Accountant not found" });
    }
    
    const isMatch = await bcrypt.compare(currentPassword, accountant.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }
    
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    accountant.password = hashedPassword;
    await accountant.save();
    
    res.json({ message: "Password changed successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

/*  HELPER FUNCTIONS  */

/* Get All Classes (for dropdown)*/
const getClasses = async (req, res) => {
  try {
    const classes = await Class.find({ isActive: true })
      .select("className section");
    
    res.json({ classes });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

/* Get Students by Class */
const getStudentsByClassaccount = async (req, res) => {
  try {
    const { classId } = req.params;

    const students = await ClassStudent.find({ 
      classId, 
      isActive: true 
    })
      .populate("studentId", "name email rollNo admissionNo")
      .select("studentId");

    res.json({
      total: students.length,
      students: students.map(s => s.studentId)
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  // Fee Structure
  createFeeStructure, getFeeStructures,
  updateFeeStructure, deleteFeeStructure, 
  // Student Fee
  assignFeeToStudent,
  getStudentFees,
  getStudentFeeDetails,
  
  // Payments
  receiveFeePayment,
  getPaymentHistory,
  
  // Reports & Statistics
  getFeeStatistics,
  getDueFees,
  getFeeReport,
  
  // Profile
  getAccountantProfile,
  updateAccountantProfile,
  changeAccountantPassword,
  
  // Helpers
  getClasses,
  getStudentsByClassaccount
};