import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://brjmdlwhzqktejudpeso.supabase.co";
const serviceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyam1kbHdoenFrdGVqdWRwZXNvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTM2OTU0OCwiZXhwIjoyMDk0OTQ1NTQ4fQ.ZnaIZlOEqHMF0oxvwaoM3eg6Z-B8joT3j0jjZ50n2IU";
const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyam1kbHdoenFrdGVqdWRwZXNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzNjk1NDgsImV4cCI6MjA5NDk0NTU0OH0.3YNolaJaVre7fMYd7pTuQLePY9jmfq7IP58JxPy42Cg";

async function main() {
  const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  const email = "abdulazeezrazvi125@gmail.com";

  console.log(`Generating magic link for user: ${email}`);
  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email: email
  });

  if (linkError) {
    console.error("Error generating link:", linkError);
    return;
  }

  if (linkData.properties?.email_otp) {
    const supabaseClient = createClient(supabaseUrl, anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    console.log("Attempting to verify OTP...");
    const { data: sessionData, error: verifyError } = await supabaseClient.auth.verifyOtp({
      email: email,
      token: linkData.properties.email_otp,
      type: 'magiclink'
    });

    if (verifyError) {
      console.error("Error verifying OTP:", verifyError);
      return;
    }

    const userToken = sessionData.session?.access_token;
    console.log("JWT token obtained.");

    const tables = ["profiles", "contacts", "conversations", "deals", "broadcasts", "automations"];
    for (const t of tables) {
      console.log(`Querying ${t}...`);
      const res = await fetch(`${supabaseUrl}/rest/v1/${t}?select=id`, {
        method: 'HEAD',
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${userToken}`,
          Prefer: "count=exact"
        }
      });
      console.log(`Table ${t} status:`, res.status);
      console.log(`Table ${t} headers:`, Object.fromEntries(res.headers.entries()));
    }
  }
}

main().catch(console.error);
