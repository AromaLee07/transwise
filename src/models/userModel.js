const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    // required: true,
    unique: true, // 确保用户名的唯一性
    trim: true, // 去除用户名两端的空格
  },
  email: {
    type: String,
    required: true,
    unique: true, // 确保电子邮件地址的唯一性
    trim: true,
    lowercase: true, // 将电子邮件地址转换为小写
    validate: [validateEmail, "Please fill a valid email address"], // 验证电子邮件格式是否正确
  },
  // password: {
  //   type: String,
  //   required: true,
  //   minlength: 8, // 设置密码的最小长度
  // },
  avatarUrl: {
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now, // 默认值为创建文档的当前时间
  },
  isPaidUser: {
    type: Boolean,
    default: false, // 新创建的用户默认为活跃状态
  },
  googleId: { type: String, unique: true, sparse: true }, // 仅适用于Google登录的用户
  passwordHash: { type: String, equired: true, minlength: 8,}, // 设置密码的最小长度 }, // 仅适用于邮箱密码登录的用户
  passwordSalt: { type: String },

  dailyClicks: {
    date: {
      type: Date,
      default: Date.now,
    },
    count: {
      type: Number,
      default: 0,
    },
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  stripeCustomerId: {  // 新增字段
    type: String,
    unique: true,
    sparse: true,  // 允许该字段为 null 或未定义
  },
});

// 虚拟字段 userId
userSchema.virtual("userId").get(function () {
  return this._id.toHexString();
});

// 确保在 JSON 输出中包含 userId
userSchema.set("toJSON", {
  virtuals: true,
});

// 邮件验证函数
function validateEmail(email) {
  const re =
    /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(email);
}

// 密码加密的预保存钩子
userSchema.pre("save", async function (next) {
  // 只有在密码被更改时才运行加密
  if (this.isModified("passwordHash")) {
    this.passwordHash = await bcrypt.hash(this.passwordHash, 8);
  }
  next();
});

const User = mongoose.model("User", userSchema);

module.exports = User;