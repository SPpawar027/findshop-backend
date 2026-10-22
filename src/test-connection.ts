import { sequelize } from "./config/database";

async function testConnection() {
  console.log("Connecting to database at:", process.env.DATABASE_URL ? process.env.DATABASE_URL.replace(/:[^:@]*@/, ":****@") : "MISSING");
  try {
    await sequelize.authenticate();
    console.log("\n✅ SUCCESS! Connected to AWS RDS PostgreSQL successfully!");
    
    // Check tables in public schema
    const [tables] = await sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    console.log("\n📊 Existing Tables in Database:");
    if ((tables as any[]).length === 0) {
      console.log("⚠️  No tables found in 'public' schema yet.");
      console.log("👉 Run migrations to create your tables: npx sequelize-cli db:migrate\n");
    } else {
      (tables as any[]).forEach((t: any) => console.log(`  - ${t.table_name}`));
      console.log(`\nTotal tables: ${(tables as any[]).length}\n`);
    }
    
    process.exit(0);
  } catch (error: any) {
    console.error("\n❌ Connection Failed!");
    console.error("Error Details:", error.message || error);
    process.exit(1);
  }
}

testConnection();
