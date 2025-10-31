import { MongoClient, Db } from 'mongodb';

export class MongoDBAdapter {
  private client: MongoClient;
  private db: Db | null = null;

  constructor(uri: string, dbName: string) {
    this.client = new MongoClient(uri);
    this.db = null;
  }

  async connect(): Promise<void> {
    await this.client.connect();
    this.db = this.client.db();
  }

  async disconnect(): Promise<void> {
    await this.client.close();
  }

  getDb(): Db {
    if (!this.db) {
      throw new Error('Database not connected');
    }
    return this.db;
  }

  // Basic CRUD operations
  async find(collection: string, query: any = {}, options: any = {}): Promise<any[]> {
    const coll = this.getDb().collection(collection);
    return coll.find(query, options).toArray();
  }

  async findOne(collection: string, query: any = {}): Promise<any> {
    const coll = this.getDb().collection(collection);
    return coll.findOne(query);
  }

  async insertOne(collection: string, document: any): Promise<any> {
    const coll = this.getDb().collection(collection);
    return coll.insertOne(document);
  }

  async insertMany(collection: string, documents: any[]): Promise<any> {
    const coll = this.getDb().collection(collection);
    return coll.insertMany(documents);
  }

  async updateOne(collection: string, query: any, update: any, options: any = {}): Promise<any> {
    const coll = this.getDb().collection(collection);
    return coll.updateOne(query, update, options);
  }

  async updateMany(collection: string, query: any, update: any, options: any = {}): Promise<any> {
    const coll = this.getDb().collection(collection);
    return coll.updateMany(query, update, options);
  }

  async deleteOne(collection: string, query: any): Promise<any> {
    const coll = this.getDb().collection(collection);
    return coll.deleteOne(query);
  }

  async deleteMany(collection: string, query: any): Promise<any> {
    const coll = this.getDb().collection(collection);
    return coll.deleteMany(query);
  }
}