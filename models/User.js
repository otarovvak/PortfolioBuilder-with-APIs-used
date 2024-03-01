const { Schema, model } = require("mongoose");
const bcrypt = require('bcrypt');
const userSchema = new Schema({
    username: { type: String },
    email: { type: String },
    password: { type: String },
    age: { type: Number },
    country: { type: String },
    gender: { type: String, enum: ['male', 'female', 'other'] },
    role: { type: String, default: "user" }
}, { timestamps: true });

userSchema.pre("save", async function (next) {
    try {
      const user = this;
      if (user.isModified("password")) {
        const salt = await bcrypt.genSalt(10); // Generate a random salt
        user.password = await bcrypt.hash(user.password, salt);
      }
      next();
    } catch (err) {
      console.error(err);
      throw err;
    }
});

module.exports = model('users', userSchema);