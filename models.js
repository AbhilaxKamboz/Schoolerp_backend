const mongoose = require("mongoose");

// User Schema
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true,
      unique: true
    },
    password: {
      type: String,
      required: true
    },
    role: {
      type: String,
      enum: ["admin", "teacher", "student", "accountant"],
      default: "admin"
    },
    isActive: {
      type: Boolean,
      default: true
    },
    gender: String,
    //Teacher Fields
    subject: String,
    assignedClass: String,

    //Student Fields
    className: String,
    section: String,
    rollNo: String,
    admissionNo: {
      type: String,
      unique: true
    },

    // Default
    Dob:{
      type:Date,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

// Class Schema
const classSchema = new mongoose.Schema(
  {
    className: {
      type: String,
      required: true
    },
    section: {
      type: String,
      required: true
    },

    // Optional for now (later assign)
    classTeacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },

    isActive: {
      type: Boolean,
      default: true
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    }
  },
  { timestamps: true }
);

//  Prevent duplicate Class + Section
classSchema.index({ className: 1, section: 1 }, { unique: true });

const Class = mongoose.model("Class", classSchema);

// Subject module
const subjectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true
    },
    code: {
      type: String,
      required: true,
      unique: true
    },
    isActive: {
      type: Boolean,
      default: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    }
  },
  { timestamps: true }
);

const Subject = mongoose.model("Subject", subjectSchema);

// class subject model
const classSubjectSchema = new mongoose.Schema(
  {
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: true
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      required: true
    },
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    isActive: {
      type: Boolean,
      default: true
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    }
  },
  { timestamps: true }
);

// Same subject same class can not duplicate 
classSubjectSchema.index(
  { classId: 1, subjectId: 1 },
  { unique: true }
);

const ClassSubject = mongoose.model("ClassSubject", classSubjectSchema);

// class student module
const classStudentSchema = new mongoose.Schema(
  {
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: true
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    isActive: {
      type: Boolean,
      default: true
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    }
  },
  { timestamps: true }
);

//  Same student same class duplicate na ho
classStudentSchema.index(
  { classId: 1, studentId: 1 },
  { unique: true }
);

const ClassStudent = mongoose.model("ClassStudent", classStudentSchema);

// Attendance model
const attendanceSchema = new mongoose.Schema(
  {
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: true
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      required: true
    },
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    date: {
      type: Date, // YYYY-MM-DD
      required: true
    },
    status: {
      type: String,
      enum: ["present", "absent"],
      required: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    }
  },
  { timestamps: true }
);

//  Same student, same subject, same date can not create duplicate
attendanceSchema.index(
  { classId: 1, subjectId: 1, studentId: 1, date: 1 },
  { unique: true }
);

const Attendance = mongoose.model("Attendance", attendanceSchema);

// Home work module
const homeworkSchema = new mongoose.Schema(
  {
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: true
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      required: true
    },
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    title: {
      type: String,
      required: true
    },
    description: {
      type: String,
      required: true
    },

    dueDate: {
      type: String, // YYYY-MM-DD
      required: true
    },

    isActive: {
      type: Boolean,
      default: true
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    }
  },
  { timestamps: true }
);

const Homework = mongoose.model("Homework", homeworkSchema);

// Assignment model
const assignmentSchema = new mongoose.Schema(
  {
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: true
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      required: true
    },
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    title: {
      type: String,
      required: true
    },
    description: {
      type: String,
      required: true
    },

    type: {
      type: String,
      enum: ["homework", "assignment"],
      default: "assignment"
    },

    dueDate: {
      type: String, // YYYY-MM-DD
      required: true
    },

    totalMarks: {
      type: Number,
      default: null // homework ke liye null
    },

    isActive: {
      type: Boolean,
      default: true
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    }
  },
  { timestamps: true }
);

const Assignment = mongoose.model("Assignment", assignmentSchema);

// Assignment submission Module
const submissionSchema = new mongoose.Schema(
  {
    assignmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Assignment",
      required: true
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    submissionText: {
      type: String,
      required: true
    },

    submittedAt: {
      type: Date,
      default: Date.now
    },

    marksObtained: {
      type: Number,
      default: null
    },

    status: {
      type: String,
      enum: ["submitted", "checked"],
      default: "submitted"
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    }
  },
  { timestamps: true }
);

// One student → one submission per assignment
submissionSchema.index(
  { assignmentId: 1, studentId: 1 },
  { unique: true }
);

const AssignmentSubmission = mongoose.model(
  "AssignmentSubmission",
  submissionSchema
);

// Marks/Tests Model (replacing Homework)
const marksSchema = new mongoose.Schema(
  {
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: true
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      required: true
    },
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    testName: {
      type: String,
      required: true
    },
    description: {
      type: String,
      default: ""
    },
    testDate: {
      type: Date,
      default: Date.now
    },
    maxMarks: {
      type: Number,
      required: true
    },
    isActive: {
      type: Boolean,
      default: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    }
  },
  { timestamps: true }
);

const Marks = mongoose.model("Marks", marksSchema);

// Student Marks Model (individual student marks for each test)
const studentMarksSchema = new mongoose.Schema(
  {
    marksId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Marks",
      required: true
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    marksObtained: {
      type: Number,
      required: true
    },
    remarks: {
      type: String,
      default: ""
    },
    isActive: {
      type: Boolean,
      default: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    }
  },
  { timestamps: true }
);

// One student can have only one marks entry per test
studentMarksSchema.index(
  { marksId: 1, studentId: 1 },
  { unique: true }
);

const StudentMarks = mongoose.model("StudentMarks", studentMarksSchema);

// FeeStructure module
const feeStructureSchema = new mongoose.Schema(
  {
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: true
    },

    tuitionFee: {
      type: Number,
      required: true
    },
    examFee: {
      type: Number,
      default: 0
    },
    miscFee: {
      type: Number,
      default: 0
    },

    totalFee: {
      type: Number,
      required: true
    },

    isActive: {
      type: Boolean,
      default: true
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    }
  },
  { timestamps: true }
);

// One class → one active fee structure
feeStructureSchema.index(
  { classId: 1, isActive: 1 },
  { unique: true }
);

const FeeStructure = mongoose.model("FeeStructure", feeStructureSchema);

// Assign Fee to Student module
const studentFeeSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: true
    },
    totalFee: {
      type: Number,
      required: true
    },
    paidAmount: {
      type: Number,
      default: 0
    },
    dueAmount: {
      type: Number,
      required: true
    },
    status: {
      type: String,
      enum: ["paid", "partial", "unpaid"],
      default: "unpaid"
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    }
  },
  { timestamps: true }
);

studentFeeSchema.index(
  { studentId: 1, classId: 1 },
  { unique: true }
);

const StudentFee = mongoose.model("StudentFee", studentFeeSchema);

// Fees Payment Module
const feePaymentSchema = new mongoose.Schema(
  {
    studentFeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StudentFee",
      required: true
    },
    amountPaid: {
      type: Number,
      required: true
    },
    paymentMode: {
      type: String,
      enum: ["cash", "upi", "card", "bank"],
      required: true
    },
    paymentDate: {
      type: Date,
      default: Date.now
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    }
  },
  { timestamps: true }
);

const FeePayment = mongoose.model("FeePayment", feePaymentSchema);

module.exports = { User, Class, Subject, ClassSubject, ClassStudent, Attendance, Homework, Assignment, AssignmentSubmission, FeeStructure, StudentFee, FeePayment, Marks, StudentMarks };
