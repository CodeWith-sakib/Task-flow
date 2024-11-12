import * as crypto from 'crypto';
import { TaskFlowPlugin } from '../types';
import { Task, CreateTaskRequest } from '../../types';

export class EncryptionPlugin implements TaskFlowPlugin {
  name = 'PayloadEncryption';
  version = '1.0.0';
  private secretKey: Buffer;

  constructor(secretHex: string = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef') {
    this.secretKey = Buffer.from(secretHex.slice(0, 64), 'hex');
  }

  async beforeCreateTask(request: CreateTaskRequest): Promise<CreateTaskRequest> {
    if (!request.payload || request.payload.__encrypted) return request;
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.secretKey, iv);
    const plaintext = JSON.stringify(request.payload);
    let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
    ciphertext += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    return {
      ...request,
      payload: {
        __encrypted: true,
        iv: iv.toString('hex'),
        authTag,
        data: ciphertext,
      },
    };
  }

  async beforeExecuteTask(task: Task): Promise<Task> {
    if (!task.payload || !task.payload.__encrypted) return task;
    const iv = Buffer.from(task.payload.iv, 'hex');
    const authTag = Buffer.from(task.payload.authTag, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.secretKey, iv);
    decipher.setAuthTag(authTag);
    let plaintext = decipher.update(task.payload.data, 'hex', 'utf8');
    plaintext += decipher.final('utf8');
    return {
      ...task,
      payload: JSON.parse(plaintext),
    };
  }
}
