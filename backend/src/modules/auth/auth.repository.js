import { User } from './user.model.js';

const findByEmail = (email) => User.findOne({ email });

const create = (data) => User.create(data);

export { findByEmail, create };
