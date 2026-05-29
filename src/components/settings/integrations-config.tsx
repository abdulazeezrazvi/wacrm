'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Copy,
  Check,
  Zap,
  Globe,
  Settings,
  Info,
  Database,
  ArrowRight,
  RefreshCw,
  GitBranch,
  Key,
  Terminal,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

interface Stage {
  id: string;
  name: string;
  position: number;
}

interface Pipeline {
  id: string;
  name: string;
  stages: Stage[];
}

export function IntegrationsConfig() {
  const supabase = createClient();
  
  // Settings state
  const [n8nEnabled, setN8nEnabled] = useState(false);
  const [n8nWebhookUrl, setN8nWebhookUrl] = useState('');
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [needsMigration, setNeedsMigration] = useState(false);

  // Pipeline/Stage lookups
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loadingPipelines, setLoadingPipelines] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Load user settings
  const fetchSettings = useCallback(async () => {
    setLoadingSettings(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;

      if (profile) {
        // Safe property checks (to handle missing database columns gracefully)
        const enabled = (profile as any).n8n_enabled;
        const url = (profile as any).n8n_webhook_url;

        // If these fields are undefined, we might need a migration
        if (enabled === undefined && url === undefined) {
          setNeedsMigration(true);
        } else {
          setN8nEnabled(!!enabled);
          setN8nWebhookUrl(url || '');
          setNeedsMigration(false);
        }
      }
    } catch (err) {
      console.error('Failed to load integration settings:', err);
      // If column doesn't exist, Supabase returns a 400 bad request / undefined column error
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('n8n_enabled') || msg.includes('column does not exist')) {
        setNeedsMigration(true);
      }
    } finally {
      setLoadingSettings(false);
    }
  }, [supabase]);

  // Load pipelines & stages
  const fetchPipelines = useCallback(async () => {
    setLoadingPipelines(true);
    try {
      const { data: pipelinesData, error: pipelinesError } = await supabase
        .from('pipelines')
        .select('id, name')
        .order('created_at');

      if (pipelinesError) throw pipelinesError;

      if (!pipelinesData) {
        setPipelines([]);
        return;
      }

      const { data: stagesData, error: stagesError } = await supabase
        .from('pipeline_stages')
        .select('id, name, pipeline_id, position')
        .order('position');

      if (stagesError) throw stagesError;

      const mapped: Pipeline[] = pipelinesData.map((p) => {
        const stages = (stagesData || [])
          .filter((s) => s.pipeline_id === p.id)
          .map((s) => ({
            id: s.id,
            name: s.name,
            position: s.position,
          }));

        return { id: p.id, name: p.name, stages };
      });

      setPipelines(mapped);
    } catch (err) {
      console.error('Failed to load pipelines:', err);
    } finally {
      setLoadingPipelines(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchSettings();
    fetchPipelines();
  }, [fetchSettings, fetchPipelines]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Copied to clipboard!');
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('profiles')
        .update({
          n8n_enabled: n8nEnabled,
          n8n_webhook_url: n8nWebhookUrl.trim() || null,
        } as any)
        .eq('user_id', user.id);

      if (error) {
        // Catch columns missing error
        if (error.message.includes('n8n_enabled') || error.code === '42703') {
          setNeedsMigration(true);
          throw new Error('Database schema update required. Please apply the migration shown below.');
        }
        throw error;
      }

      toast.success('Integration settings updated successfully!');
      setNeedsMigration(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save settings';
      toast.error(msg);
    } finally {
      setSavingSettings(false);
    }
  };

  const migrationSql = `-- Run this in your Supabase SQL Editor
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS n8n_webhook_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS n8n_enabled BOOLEAN DEFAULT FALSE;`;

  const samplePayload = `{
  "event": "new_message_received",
  "user_id": "user-uuid-12345",
  "contact_id": "contact-uuid-67890",
  "contact": {
    "id": "contact-uuid-67890",
    "name": "John Doe",
    "phone": "+919876543210",
    "email": "john.doe@example.com",
    "company": "Lead Corp"
  },
  "context": {
    "message_text": "Hello, I want to inquire about pricing.",
    "conversation_id": "conversation-uuid-999"
  },
  "timestamp": "${new Date().toISOString()}"
}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Zap className="size-5 text-violet-400" />
          n8n & Webhook Integrations
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          Configure real-time sync with n8n workflow automations, Make, Zapier, or your custom endpoints.
        </p>
      </div>

      {/* Migration Alert Callout */}
      {needsMigration && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-amber-400 text-sm font-semibold flex items-center gap-2">
              <Terminal className="size-4 text-amber-400" />
              Supabase Schema Update Required
            </CardTitle>
            <CardDescription className="text-slate-300 text-xs">
              To support the global n8n toggle and webhook url saving, we need to add the `n8n_enabled` and `n8n_webhook_url` columns to the `profiles` table.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-slate-400">
              Please copy the SQL script below and execute it in your **Supabase Project → SQL Editor**:
            </p>
            <div className="relative bg-slate-950 p-3 rounded-lg border border-slate-800">
              <pre className="text-xs text-amber-200/90 font-mono overflow-x-auto whitespace-pre-wrap select-all pr-12">
                {migrationSql}
              </pre>
              <button
                onClick={() => copyToClipboard(migrationSql, 'migration-sql')}
                className="absolute top-2.5 right-2.5 p-1.5 rounded bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                title="Copy SQL"
              >
                {copiedId === 'migration-sql' ? (
                  <Check className="size-3.5 text-emerald-400" />
                ) : (
                  <Copy className="size-3.5" />
                )}
              </button>
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchSettings}
                className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1.5"
              >
                <RefreshCw className="size-3 animate-spin-hover" />
                Re-check Database Columns
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main n8n Connection Card */}
      <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
            <Globe className="size-4.5 text-violet-400" />
            Automatic n8n Event Router
          </CardTitle>
          <CardDescription className="text-slate-400 text-xs">
            When enabled, every event received in the CRM (inbound messages, deal updates, new leads, etc.) is instantly forwarded to your n8n workflow trigger URL.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingSettings ? (
            <div className="py-6 flex justify-center">
              <RefreshCw className="size-6 animate-spin text-violet-400" />
            </div>
          ) : (
            <form onSubmit={handleSaveSettings} className="space-y-6">
              <div className="flex items-center justify-between p-4 rounded-lg bg-slate-950/40 border border-slate-800/80">
                <div className="space-y-0.5">
                  <Label htmlFor="n8nToggle" className="text-sm font-medium text-white cursor-pointer">
                    Enable Automatic Webhook Routing
                  </Label>
                  <p className="text-xs text-slate-400">
                    Forward incoming messages and contact events directly to n8n.
                  </p>
                </div>
                <Switch
                  id="n8nToggle"
                  checked={n8nEnabled}
                  onCheckedChange={setN8nEnabled}
                  disabled={needsMigration}
                />
              </div>

              {n8nEnabled && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-3 duration-200">
                  <Label htmlFor="webhookUrl" className="text-slate-300 text-xs">
                    n8n Webhook Trigger URL
                  </Label>
                  <div className="relative">
                    <Input
                      id="webhookUrl"
                      type="url"
                      required={n8nEnabled}
                      placeholder="https://primary-n8n.domain.com/webhook/..."
                      value={n8nWebhookUrl}
                      onChange={(e) => setN8nWebhookUrl(e.target.value)}
                      disabled={needsMigration}
                      className="border-slate-700 bg-slate-800/40 text-white focus-visible:ring-violet-500/20 focus-visible:border-violet-500"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-1">
                    <Info className="size-3 text-slate-500" />
                    Enter the URL of your Webhook node in n8n (use a POST method node).
                  </p>
                </div>
              )}

              <div className="flex justify-end pt-2 border-t border-slate-800/60">
                <Button
                  type="submit"
                  disabled={savingSettings || needsMigration}
                  className="bg-violet-600 hover:bg-violet-700 text-white font-medium text-xs px-5 py-2 flex items-center gap-2"
                >
                  {savingSettings ? 'Saving...' : 'Save Settings'}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Setup Instructions Accordion/Tabs */}
      <Card className="border-slate-800 bg-slate-900/20">
        <CardHeader className="pb-4">
          <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
            <Database className="size-4.5 text-blue-400" />
            n8n Integration Guide & Setup Instructions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 text-xs text-slate-300">
          {/* Outbound webhook explanation */}
          <div className="space-y-2 border-l-2 border-violet-500/40 pl-4">
            <h4 className="text-white font-semibold text-sm flex items-center gap-1">
              1. Outbound Sync (CRM → n8n Webhook)
            </h4>
            <p className="text-slate-400">
              When Automatic Routing is enabled above, the CRM sends a POST request containing contact information and incoming message text. Use this to trigger alerts, sync with Google Sheets, or pipe leads to a custom database.
            </p>
            <div className="mt-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Example Payload sent to n8n:</span>
              <div className="relative mt-1.5 bg-slate-950 p-3 rounded-lg border border-slate-800">
                <pre className="text-[11px] text-slate-400 font-mono overflow-x-auto whitespace-pre pr-12">
                  {samplePayload}
                </pre>
                <button
                  onClick={() => copyToClipboard(samplePayload, 'sample-payload')}
                  className="absolute top-2.5 right-2.5 p-1.5 rounded bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                  title="Copy Sample JSON"
                >
                  {copiedId === 'sample-payload' ? (
                    <Check className="size-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Inbound database explanation */}
          <div className="space-y-2 border-l-2 border-blue-500/40 pl-4">
            <h4 className="text-white font-semibold text-sm">
              2. Inbound Sync (n8n → CRM database)
            </h4>
            <p className="text-slate-400">
              To update deals, create new contacts, or update pipelines from n8n, use the standard **Supabase Node** or **PostgreSQL Node** in n8n.
            </p>
            <div className="grid gap-4 sm:grid-cols-2 mt-3 pt-1">
              <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                <span className="font-semibold text-white block mb-1">Key Tables to Target:</span>
                <ul className="space-y-1.5 list-disc pl-4 text-slate-400">
                  <li><code className="text-blue-300 font-mono">contacts</code>: Update lead names, emails, companies</li>
                  <li><code className="text-blue-300 font-mono">deals</code>: Create sales deals, assign values, move pipeline stages</li>
                  <li><code className="text-blue-300 font-mono">conversations</code>: Re-assign chats to other agents</li>
                  <li><code className="text-blue-300 font-mono">contact_tags</code>: Apply/remove tags to trigger automations</li>
                </ul>
              </div>
              <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                <span className="font-semibold text-white block mb-1">Database Credentials:</span>
                <p className="text-slate-400 leading-relaxed">
                  Go to your **Supabase Project → Settings → API** and copy:
                </p>
                <div className="mt-2 space-y-1">
                  <div className="flex items-center justify-between bg-slate-900 px-2 py-1 rounded border border-slate-800 text-[10px]">
                    <span className="text-slate-500 uppercase font-semibold">API URL</span>
                    <span className="text-slate-400 font-mono select-all truncate max-w-xs">{process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://brjmdlwhzqktejudpeso.supabase.co'}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-2">
                    Use your <code className="text-amber-400">service_role</code> secret key in n8n to bypass Row Level Security.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Embedded UUID pipeline lookup */}
          <div className="space-y-3 border-l-2 border-emerald-500/40 pl-4 pt-1">
            <h4 className="text-white font-semibold text-sm flex items-center justify-between">
              <span>3. Pipelines & Stages UUID Finder</span>
              <button
                onClick={fetchPipelines}
                className="flex items-center gap-1 px-2 py-0.5 rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 text-[10px] font-medium text-slate-300 transition-colors shrink-0"
              >
                <RefreshCw className="size-3" />
                Refresh IDs
              </button>
            </h4>
            <p className="text-slate-400">
              When creating deals or moving leads via n8n Supabase nodes, you must specify the exact UUID of the pipeline and the target stage. Copy them directly below:
            </p>

            {loadingPipelines ? (
              <div className="py-4 flex justify-center">
                <RefreshCw className="size-4 animate-spin text-emerald-400" />
              </div>
            ) : pipelines.length === 0 ? (
              <p className="text-slate-500 italic">No pipelines found. Please configure pipelines in your dashboard settings first.</p>
            ) : (
              <div className="space-y-3 mt-3">
                {pipelines.map((pipeline) => (
                  <div key={pipeline.id} className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between gap-4 border-b border-slate-900 pb-2">
                      <span className="font-semibold text-white flex items-center gap-1.5">
                        <GitBranch className="size-3.5 text-emerald-400" />
                        {pipeline.name}
                      </span>
                      <div className="flex items-center gap-1.5 bg-slate-900 px-2 py-1 rounded text-[10px]">
                        <span className="text-slate-500 font-semibold uppercase">Pipeline ID</span>
                        <code className="text-emerald-300 font-mono truncate max-w-[120px] select-all">{pipeline.id}</code>
                        <button
                          onClick={() => copyToClipboard(pipeline.id, `pipeline-${pipeline.id}`)}
                          className="text-slate-500 hover:text-white transition-colors"
                          title="Copy Pipeline ID"
                        >
                          {copiedId === `pipeline-${pipeline.id}` ? (
                            <Check className="size-3 text-emerald-400" />
                          ) : (
                            <Copy className="size-3" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
                      {pipeline.stages.map((stage) => (
                        <div key={stage.id} className="p-2 rounded bg-slate-900/50 border border-slate-800/80 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <span className="text-slate-200 font-medium block truncate">{stage.name}</span>
                            <code className="text-[10px] text-slate-500 font-mono select-all truncate block mt-0.5">{stage.id}</code>
                          </div>
                          <button
                            onClick={() => copyToClipboard(stage.id, `stage-${stage.id}`)}
                            className="p-1 rounded bg-slate-950 text-slate-500 hover:text-white transition-colors shrink-0"
                            title="Copy Stage ID"
                          >
                            {copiedId === `stage-${stage.id}` ? (
                              <Check className="size-3 text-emerald-400" />
                            ) : (
                              <Copy className="size-3" />
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
