"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MessageSquare, CheckCircle, Tag } from "lucide-react";

interface SaasSettings {
  free_code: string | null;
  discount_code: string | null;
  discount_percentage: number;
}

export default function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [promoStatus, setPromoStatus] = useState<{ type: 'free' | 'discount' | 'error'; msg: string } | null>(null);
  const [saasSettings, setSaasSettings] = useState<SaasSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const supabase = createClient();

  // Load saas_settings once on mount so we can validate promo codes client-side
  useEffect(() => {
    supabase
      .from('saas_settings')
      .select('free_code,discount_code,discount_percentage')
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setSaasSettings(data as SaasSettings);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function validatePromoCode(code: string) {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed || !saasSettings) { setPromoStatus(null); return; }

    if (saasSettings.free_code && trimmed === saasSettings.free_code.toUpperCase()) {
      setPromoStatus({ type: 'free', msg: '🎉 Lifetime free access! Your account will never be billed.' });
    } else if (saasSettings.discount_code && trimmed === saasSettings.discount_code.toUpperCase()) {
      setPromoStatus({ type: 'discount', msg: `🏷️ ${saasSettings.discount_percentage}% discount will be applied to your subscription.` });
    } else {
      setPromoStatus({ type: 'error', msg: '❌ Invalid promo code.' });
    }
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    const trimmedCode = promoCode.trim().toUpperCase();
    const isLifetimeFree = saasSettings?.free_code && trimmedCode === saasSettings.free_code.toUpperCase();

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          promo_code: trimmedCode || null,
          subscription_status: isLifetimeFree ? 'lifetime_free' : 'trial',
        },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
        <Card className="w-full max-w-md border-slate-800 bg-slate-900">
          <CardHeader className="items-center text-center">
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/10">
              <CheckCircle className="h-6 w-6 text-violet-500" />
            </div>
            <CardTitle className="text-xl text-white">
              Check your email
            </CardTitle>
            <CardDescription className="text-slate-400">
              We&apos;ve sent a confirmation link to{" "}
              <span className="text-white">{email}</span>. Please check your
              inbox and click the link to verify your account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/login">
              <Button
                variant="outline"
                className="w-full border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
              >
                Back to sign in
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <Card className="w-full max-w-md border-slate-800 bg-slate-900">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/10">
            <MessageSquare className="h-6 w-6 text-violet-500" />
          </div>
          <CardTitle className="text-xl text-white">Create account</CardTitle>
          <CardDescription className="text-slate-400">
            Get started with CRM for WhatsApp — 1 month free
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignup} className="flex flex-col gap-4">
            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor="fullName" className="text-slate-300">
                Full name
              </Label>
              <Input
                id="fullName"
                type="text"
                placeholder="John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="border-slate-700 bg-slate-800 text-white placeholder:text-slate-500 focus-visible:border-violet-500 focus-visible:ring-violet-500/20"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="email" className="text-slate-300">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="border-slate-700 bg-slate-800 text-white placeholder:text-slate-500 focus-visible:border-violet-500 focus-visible:ring-violet-500/20"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="password" className="text-slate-300">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="border-slate-700 bg-slate-800 text-white placeholder:text-slate-500 focus-visible:border-violet-500 focus-visible:ring-violet-500/20"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="confirmPassword" className="text-slate-300">
                Confirm password
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Repeat your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="border-slate-700 bg-slate-800 text-white placeholder:text-slate-500 focus-visible:border-violet-500 focus-visible:ring-violet-500/20"
              />
            </div>

            {/* Promo / Lifetime Code */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="promoCode" className="flex items-center gap-1.5 text-slate-300">
                <Tag className="h-3.5 w-3.5" />
                Promo / Lifetime code <span className="text-slate-500">(optional)</span>
              </Label>
              <Input
                id="promoCode"
                type="text"
                placeholder="e.g. LIFETIMEFREE"
                value={promoCode}
                onChange={(e) => {
                  const v = e.target.value.toUpperCase();
                  setPromoCode(v);
                  validatePromoCode(v);
                }}
                className="border-slate-700 bg-slate-800 font-mono text-white placeholder:text-slate-500 focus-visible:border-violet-500 focus-visible:ring-violet-500/20"
              />
              {promoStatus && (
                <p className={`rounded-md px-3 py-2 text-xs ${
                  promoStatus.type === 'error'
                    ? 'bg-rose-500/10 text-rose-400'
                    : promoStatus.type === 'free'
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-amber-500/10 text-amber-400'
                }`}>
                  {promoStatus.msg}
                </p>
              )}
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="mt-2 h-10 w-full bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-50"
            >
              {loading ? "Creating account..." : "Create account"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-400">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-violet-500 hover:text-violet-400"
            >
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
