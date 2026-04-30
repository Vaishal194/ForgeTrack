import pg from 'pg';
const { Client } = pg;

const connectionString = 'postgresql://postgres:yshalnv123%23@db.gqrpyccjprzqrmlebmbb.supabase.co:5432/postgres';
const client = new Client({ connectionString });

async function run() {
  await client.connect();
  try {
    const sql = `
      DO $$
      DECLARE
        new_user_id UUID := gen_random_uuid();
      BEGIN
        DELETE FROM auth.users WHERE email = 'nischay@theboringpeople.in';
        DELETE FROM public.users WHERE email = 'nischay@theboringpeople.in';
        
        INSERT INTO auth.users (
          id, email, encrypted_password, email_confirmed_at, 
          raw_app_meta_data, raw_user_meta_data, created_at, updated_at, 
          role, aud, instance_id
        ) VALUES (
          new_user_id, 'nischay@theboringpeople.in', 
          crypt('password123', gen_salt('bf')), NOW(), 
          '{"provider": "email", "providers": ["email"]}', '{}', 
          NOW(), NOW(), 'authenticated', 'authenticated', 
          '00000000-0000-0000-0000-000000000000'
        );

        INSERT INTO public.users (id, email, role, display_name)
        VALUES (new_user_id, 'nischay@theboringpeople.in', 'mentor', 'Nischay B K');
      END $$;
    `;
    await client.query(sql);
    console.log("Success: Mentor user created.");
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.end();
  }
}

run();
