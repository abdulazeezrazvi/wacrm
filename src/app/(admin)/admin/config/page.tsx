'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { CreditCard, Save, Loader2, Key, Percent, Check } from 'lucide-react';
import { toast } from 'sonner';

export default function SaaSConfigPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);

  // States for the SaaS fields
  const [starterPrice, setStarterPrice] = useState(499);
  const [proPrice, setProPrice] = useState(999);
  const [freeCode, setFreeCode] = useState('LIFETIMEFREE');
  const [discountCode, setDiscountCode] = useState('CRM50');
  const [discountPercentage, setDiscountPercentage] = useState(50);

  useEffect(() => {
    let cancelled = false;
    async function loadSettings() {
      setLoading(true);
      try {
        // Read uses public SELECT policy (works fine), keep using client
        const { data, error } = await supabase
          .from('saas_settings')
          .select('*')
          .limit(1)
          .maybeSingle();

        if (error) {
          throw new Error(error.message);
        }

        if (data && !cancelled) {
          setSettingsId(data.id);
          setStarterPrice(Number(data.starter_price));
          setProPrice(Number(data.pro_price));
          setFreeCode(data.free_code || '');
          setDiscountCode(data.discount_code || '');
          setDiscountPercentage(Number(data.discount_percentage || 0));
        }
      } catch (err) {
        console.error('Failed to load SaaS configurations:', err);
        toast.error('Failed to load SaaS configurations');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadSettings();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const payload = {
      id: settingsId,
      starter_price: Number(starterPrice) || 0,
      pro_price: Number(proPrice) || 0,
      free_code: freeCode.trim() || null,
      discount_code: discountCode.trim() || null,
      discount_percentage: Number(discountPercentage) || 0,
    };

    try {
      const res = await fetch('/api/admin/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || `Server error ${res.status}`);
      }

      if (json.settings?.id) {
        setSettingsId(json.settings.id);
      }

      toast.success('SaaS settings updated successfully!');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Failed to save: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
          <p className="text-sm text-slate-400">Loading configurations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">SaaS Configuration Panel</h2>
        <p className="text-sm text-slate-400 mt-1">
          Manage pricing, promotional codes, lifetime bypass codes, and discounts for your SaaS platform.
        </p>
      </div>

      <form onSubmit={handleSave}>
        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-md">
          <CardHeader className="border-b border-slate-800/80 pb-4">
            <CardTitle className="flex items-center gap-2 text-white">
              <CreditCard className="h-5 w-5 text-amber-400" />
              Billing & Promotion Rules
            </CardTitle>
            <CardDescription className="text-slate-400">
              Changes applied here will immediately update the public landing page prices and discount validations.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            
            {/* Plan Prices */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="starterPrice" className="text-slate-300">
                  Starter Plan Price (₹ / month)
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-500">₹</span>
                  <Input
                    id="starterPrice"
                    type="number"
                    min="0"
                    placeholder="499"
                    value={starterPrice}
                    onChange={(e) => setStarterPrice(Math.max(0, parseInt(e.target.value) || 0))}
                    required
                    className="border-slate-700 bg-slate-800/60 pl-8 text-white focus-visible:ring-amber-500/20 focus-visible:border-amber-500"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="proPrice" className="text-slate-300">
                  Pro Plan Price (₹ / month)
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-500">₹</span>
                  <Input
                    id="proPrice"
                    type="number"
                    min="0"
                    placeholder="999"
                    value={proPrice}
                    onChange={(e) => setProPrice(Math.max(0, parseInt(e.target.value) || 0))}
                    required
                    className="border-slate-700 bg-slate-800/60 pl-8 text-white focus-visible:ring-amber-500/20 focus-visible:border-amber-500"
                  />
                </div>
              </div>
            </div>

            <div className="my-6 border-t border-slate-800/80" />

            {/* Lifetime Free Bypass Code */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="freeCode" className="text-slate-300">
                  Lifetime Free Code
                </Label>
                <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                  <Check className="h-3 w-3" /> Bypasses Stripe
                </span>
              </div>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <Input
                  id="freeCode"
                  type="text"
                  placeholder="e.g. LIFETIMEFREE"
                  value={freeCode}
                  onChange={(e) => setFreeCode(e.target.value.toUpperCase())}
                  className="border-slate-700 bg-slate-800/60 pl-10 font-mono tracking-wide text-white focus-visible:ring-amber-500/20 focus-visible:border-amber-500"
                />
              </div>
              <p className="text-xs text-slate-400">
                When users enter this code at signup, their account is granted permanent free access, skipping billing altogether.
              </p>
            </div>

            <div className="my-6 border-t border-slate-800/80" />

            {/* Discount Code & Percentage */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="discountCode" className="text-slate-300">
                  Active Discount Code
                </Label>
                <div className="relative">
                  <Percent className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <Input
                    id="discountCode"
                    type="text"
                    placeholder="e.g. CRM50"
                    value={discountCode}
                    onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
                    className="border-slate-700 bg-slate-800/60 pl-10 font-mono tracking-wide text-white focus-visible:ring-amber-500/20 focus-visible:border-amber-500"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="discountPercentage" className="text-slate-300">
                  Discount Percentage (%)
                </Label>
                <Input
                  id="discountPercentage"
                  type="number"
                  min="0"
                  max="100"
                  placeholder="50"
                  value={discountPercentage}
                  onChange={(e) => setDiscountPercentage(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                  className="border-slate-700 bg-slate-800/60 text-white focus-visible:ring-amber-500/20 focus-visible:border-amber-500"
                />
              </div>
            </div>
            <p className="text-xs text-slate-400">
              Users who apply this code at checkout will receive the configured percentage discount on their subscription plans.
            </p>

            {/* Action buttons */}
            <div className="pt-4 border-t border-slate-800/80 flex justify-end">
              <Button
                type="submit"
                disabled={saving}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold px-6 flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save Settings
                  </>
                )}
              </Button>
            </div>

          </CardContent>
        </Card>
      </form>
    </div>
  );
}
