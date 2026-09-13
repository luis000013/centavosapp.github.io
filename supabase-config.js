// ===== VARIABLES Y CONFIGURACIÓN ORIGINAL DE SUPABASE =====
const SUPABASE_URL='https://kkkyteytkspgfvzcioyt.supabase.co';
const SUPABASE_ANON_KEY='sb_publishable_Qh5VkHGdqxoF1qCtAdLFQQ_Nu-AD_gb';
const cloudEnabled=!!(window.supabase&&SUPABASE_URL&&SUPABASE_ANON_KEY);
const sb=cloudEnabled?supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY):null;

const SETUP_SQL = `-- 1. Tabla de datos personales
CREATE TABLE IF NOT EXISTS public.app_data (
  user_id uuid references auth.users primary key,
  data jsonb not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);
ALTER TABLE public.app_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Propios datos" ON public.app_data FOR ALL USING (auth.uid() = user_id);

-- 2. Tabla Cuentas y Sanes Compartidos
CREATE TABLE IF NOT EXISTS public.shared_records (
  id text primary key,
  owner_id uuid references auth.users not null,
  partner_email text not null,
  type text not null,
  payload jsonb not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);
ALTER TABLE public.shared_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acceso a compartidos" ON public.shared_records FOR ALL USING (
  auth.uid() = owner_id OR auth.jwt() ->> 'email' = partner_email
);`;

// ===== LÓGICA DE NUBE ORIGINAL =====
async function cloudLoadOrCreate(u){
  const {data:row, error} = await sb.from('app_data').select('data').eq('user_id',u.id).maybeSingle();
  if(error) throw error;
  let d = defaultData(u);
  if(row && row.data) d = normalize(row.data, u);
  else await sb.from('app_data').insert({user_id:u.id, data:d});

  const { data: records } = await sb.from('shared_records').select('*');
  if (records) {
    const cloudShared = records.filter(r => r.type === 'sharedAccount').map(r => r.payload);
    const cloudSans = records.filter(r => r.type === 'san').map(r => r.payload);
    const localShared = d.sharedAccounts.filter(s => !s.partnerEmail);
    d.sharedAccounts = [...localShared, ...cloudShared];
    const localSans = d.sans.filter(s => s.type !== 'compartido' || !s.partnerEmail);
    d.sans = [...localSans, ...cloudSans];
  }
  return d;
}

async function syncUp(){
  if(!sb||!currentUser)return;
  const {error} = await sb.from('app_data').upsert({user_id:currentUser.id, data, updated_at:new Date().toISOString()});
  if(error) return toast('☁️ Error app_data');

  const ops = [];
  data.sharedAccounts.forEach(s => {
    if(s.partnerEmail && s.ownerId) {
       ops.push(sb.from('shared_records').upsert({
          id: s.id, owner_id: s.ownerId, partner_email: s.partnerEmail.toLowerCase(), type: 'sharedAccount', payload: s, updated_at: new Date().toISOString()
       }));
    }
  });
  data.sans.forEach(s => {
    if(s.type === 'compartido' && s.partnerEmail && s.ownerId) {
       ops.push(sb.from('shared_records').upsert({
          id: s.id, owner_id: s.ownerId, partner_email: s.partnerEmail.toLowerCase(), type: 'san', payload: s, updated_at: new Date().toISOString()
       }));
    }
  });
  if (ops.length > 0) {
    const results = await Promise.all(ops);
    const failed = results.some(r => r.error);
    if(failed) toast('☁️ Error en compartidos.');
  }
}

async function syncNow(){
  if(!sb) return toast('Nube no configurada.');
  toast('Sincronizando...', 1000);
  await syncUp();
  data = await cloudLoadOrCreate(currentUser);
  localStorage.setItem(DATA_PREFIX+currentUser.id,JSON.stringify(data));
  render();
  toast('☁️ Actualizado.');
}

function copySetupSql() {
  navigator.clipboard.writeText(SETUP_SQL);
  toast('SQL copiado');
}
