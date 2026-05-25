'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Copy, Check, GitBranch, Key, RefreshCw } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';

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

export function PipelinesConfig() {
  const supabase = createClient();
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchPipelinesAndStages = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch Pipelines
      const { data: pipelinesData, error: pipelinesError } = await supabase
        .from('pipelines')
        .select('id, name')
        .order('created_at');

      if (pipelinesError) {
        throw new Error(pipelinesError.message);
      }

      if (!pipelinesData) {
        setPipelines([]);
        return;
      }

      // 2. Fetch all Pipeline Stages
      const { data: stagesData, error: stagesError } = await supabase
        .from('pipeline_stages')
        .select('id, name, pipeline_id, position')
        .order('position');

      if (stagesError) {
        throw new Error(stagesError.message);
      }

      // 3. Group stages under their respective pipelines
      const mappedPipelines: Pipeline[] = pipelinesData.map((p) => {
        const pipelineStages = (stagesData || [])
          .filter((s) => s.pipeline_id === p.id)
          .map((s) => ({
            id: s.id,
            name: s.name,
            position: s.position,
          }));

        return {
          id: p.id,
          name: p.name,
          stages: pipelineStages,
        };
      });

      setPipelines(mappedPipelines);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load pipelines';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchPipelinesAndStages();
  }, [fetchPipelinesAndStages]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Copied ID to clipboard!');
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="h-48 w-full animate-pulse rounded-xl bg-slate-900/40 border border-slate-800" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Pipeline Integrations</h2>
          <p className="text-sm text-slate-400 mt-1">
            Find your pipeline and stage UUIDs to configure integrations with third-party tools like n8n or Zapier.
          </p>
        </div>
        <button
          onClick={fetchPipelinesAndStages}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-xs font-medium text-slate-300 hover:bg-slate-700 transition-colors"
        >
          <RefreshCw className="size-3.5" />
          Refresh
        </button>
      </div>

      {pipelines.length === 0 ? (
        <Card className="bg-slate-900/40 border-slate-800">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <GitBranch className="size-12 text-slate-600 mb-4" />
            <p className="text-slate-300 font-medium">No pipelines found</p>
            <p className="text-slate-400 text-sm mt-1">Go to the Pipelines tab in your dashboard to create one.</p>
          </CardContent>
        </Card>
      ) : (
        pipelines.map((pipeline) => (
          <Card key={pipeline.id} className="bg-slate-900/40 border-slate-800">
            <CardHeader className="border-b border-slate-800/60 pb-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-violet-500/10">
                    <GitBranch className="size-4.5 text-violet-400" />
                  </div>
                  <div>
                    <CardTitle className="text-white text-base">{pipeline.name}</CardTitle>
                    <CardDescription className="text-slate-400 text-xs">Pipeline Configuration</CardDescription>
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-slate-950/60 border border-slate-800 px-3 py-1.5 rounded-lg max-w-full md:max-w-md">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 flex items-center gap-1 shrink-0">
                    <Key className="size-3 text-slate-500" />
                    Pipeline ID
                  </span>
                  <code className="text-xs text-violet-300 font-mono select-all truncate">
                    {pipeline.id}
                  </code>
                  <button
                    onClick={() => copyToClipboard(pipeline.id, pipeline.id)}
                    className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors shrink-0"
                    title="Copy Pipeline ID"
                  >
                    {copiedId === pipeline.id ? (
                      <Check className="size-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Pipeline Stages</h4>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {pipeline.stages.map((stage) => {
                  const stageCopyKey = `${pipeline.id}-${stage.id}`;
                  return (
                    <div
                      key={stage.id}
                      className="flex flex-col justify-between p-3 rounded-lg border border-slate-800 bg-slate-950/40 hover:border-slate-700/60 transition-all group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-medium text-white line-clamp-1">{stage.name}</span>
                        <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono shrink-0">
                          Pos {stage.position}
                        </span>
                      </div>
                      
                      <div className="mt-4 flex items-center justify-between gap-2 pt-2 border-t border-slate-900/60">
                        <div className="flex flex-col min-w-0">
                          <span className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold">Stage ID</span>
                          <code className="text-[11px] text-slate-300 font-mono truncate select-all">
                            {stage.id}
                          </code>
                        </div>
                        <button
                          onClick={() => copyToClipboard(stage.id, stageCopyKey)}
                          className="p-1.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                          title="Copy Stage ID"
                        >
                          {copiedId === stageCopyKey ? (
                            <Check className="size-3 text-emerald-400" />
                          ) : (
                            <Copy className="size-3" />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
