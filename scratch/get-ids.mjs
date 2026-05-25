import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://brjmdlwhzqktejudpeso.supabase.co";
const serviceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyam1kbHdoenFrdGVqdWRwZXNvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTM2OTU0OCwiZXhwIjoyMDk0OTQ1NTQ4fQ.ZnaIZlOEqHMF0oxvwaoM3eg6Z-B8joT3j0jjZ50n2IU";

const supabase = createClient(supabaseUrl, serviceKey);

async function main() {
  const { data: pipelines, error: pError } = await supabase
    .from("pipelines")
    .select("id, name, user_id");

  if (pError) {
    console.error("Error fetching pipelines:", pError);
    return;
  }

  console.log("\n--- Pipelines with User IDs ---");
  for (const p of pipelines) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("user_id", p.user_id)
      .maybeSingle();

    console.log(`Pipeline: "${p.name}" | ID: ${p.id} | User ID: ${p.user_id} (${profile?.full_name || 'No Name'} - ${profile?.email || 'No Email'})`);
  }
}

main().catch(console.error);
