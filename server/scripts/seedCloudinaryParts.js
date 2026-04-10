require('dotenv').config();
const fs = require('fs');
const path = require('path');
const cloudinary = require('cloudinary').v2;
const { pool } = require('../config/database');

async function seedLocalAssetsToCloudinary() {
  if (!process.env.CLOUDINARY_URL) {
    console.error("❌ CLOUDINARY_URL is missing from server/.env");
    console.error("Format: cloudinary://<api_key>:<api_secret>@<cloud_name>");
    process.exit(1);
  }

  // Define local source paths
  const clientPublicNode = path.join(__dirname, '../../client/public');
  
  // Mapping of local folders to specific guitar part schemas
  // Define what types of models we have based on the folder structure
  const toProcess = [
    {
      dir: path.join(clientPublicNode, 'woodtype'),
      type: 'wood_type',
      cloudinaryFolder: 'cosmoscraft/builder/wood_types',
      price: 2500, // example price for wood upgrade
      stock: 50
    },
    {
      dir: path.join(clientPublicNode, 'builder/bass_models'),
      type: 'body', // treating bass_models as bodies for this seed
      cloudinaryFolder: 'cosmoscraft/builder/bodies',
      price: 5000,
      stock: 20
    }
  ];

  let client;

  try {
    console.log("Starting bulk Cloudinary upload and DB insertion...");
    client = await pool.connect();
    let totalUploaded = 0;

    for (const group of toProcess) {
      if (!fs.existsSync(group.dir)) {
        console.warn(`⚠️ Directory not found: ${group.dir}. Skipping...`);
        continue;
      }

      console.log(`\nProcessing folder: ${group.dir}`);
      const files = fs.readdirSync(group.dir);

      for (const file of files) {
        // Skip hidden files/directories
        if (file.startsWith('.') || fs.statSync(path.join(group.dir, file)).isDirectory()) continue;

        const filePath = path.join(group.dir, file);
        const name = path.parse(file).name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

        console.log(`Uploading ${file} to Cloudinary...`);
        
        try {
          const uploadResult = await cloudinary.uploader.upload(filePath, {
            folder: group.cloudinaryFolder,
            use_filename: true,
            unique_filename: false,
            overwrite: true
          });

          // Insert into database
          await client.query(
            `INSERT INTO guitar_builder_parts (name, description, type_mapping, price, stock, image_url, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, true)
             ON CONFLICT (part_id) DO NOTHING`, // assuming part_id is not manually specified so no conflict, but just safe
             [name, `Premium ${name} material for custom builds`, group.type, group.price, group.stock, uploadResult.secure_url]
          );

          console.log(`✓ Inserted ${name} into guitar_builder_parts (${uploadResult.secure_url})`);
          totalUploaded++;
        } catch (err) {
          console.error(`❌ Failed to upload/insert ${file}:`, err.message);
        }
      }
    }

    console.log(`\n✅ Seeding complete! Successfully migrated ${totalUploaded} assets to Cloudinary & PostgreSQL.`);
    process.exit(0);

  } catch (err) {
    console.error("❌ Fatal Seeding Error:", err);
    process.exit(1);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

seedLocalAssetsToCloudinary();
