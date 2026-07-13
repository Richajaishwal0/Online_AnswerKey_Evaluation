import Joi from "joi";

export const loginValidator = (data) => {
  const schema = Joi.object({
    email: Joi.string().email().required().messages({
      "string.email": "Invalid email format",
      "any.required": "Email is required",
    }),
    password: Joi.string().min(6).required().messages({
      "string.min": "Password must be at least 6 characters",
      "any.required": "Password is required",
    }),
  });

  return schema.validate(data, { abortEarly: false });
};

export const registerValidator = (data) => {
  const schema = Joi.object({
    email: Joi.string().email().required().messages({
      "string.email": "Invalid email format",
      "any.required": "Email is required",
    }),
    password: Joi.string().min(6).required().messages({
      "string.min": "Password must be at least 6 characters",
      "any.required": "Password is required",
    }),
    displayName: Joi.string().trim().min(2).max(60).empty("").optional(),
    role: Joi.string()
      .valid("admin", "teacher", "student")
      .required()
      .messages({
        "any.only": "Role must be admin, teacher, or student",
        "any.required": "Role is required",
      }),
  });

  return schema.validate(data, { abortEarly: false });
};

export const createMarkValidator = (data) => {
  const schema = Joi.object({
    questionId: Joi.number().required(),
    obtainedMarks: Joi.number().min(0).required().messages({
      "number.min": "Obtained marks cannot be negative",
    }),
  });

  return schema.validate(data, { abortEarly: false });
};

export const submitEvaluationValidator = (data) => {
  const schema = Joi.object({
    marks: Joi.array()
      .items(
        Joi.object({
          questionId: Joi.string().required(),
          obtainedMarks: Joi.number().min(0).required(),
        }),
      )
      .required(),
  });

  return schema.validate(data, { abortEarly: false });
};
