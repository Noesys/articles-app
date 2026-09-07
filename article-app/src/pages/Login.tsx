import { useState, useRef, KeyboardEvent, ClipboardEvent } from "react";
import { Mail, ChevronLeft, Loader2 } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { Navigate } from "react-router-dom";
import logoImage from "../Logo/Noesys_logo.png";

type Stage = "email" | "otp";
const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 30;

export default function Login() {
  const {
    requestOTP,
    verifyOTP,
    isAuthenticated,
    loading: authLoading,
  } = useAuth();

  if (!authLoading && isAuthenticated()) {
    return <Navigate to="/" replace />;
  }

  const [stage, setStage] = useState<Stage>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [devOtp, setDevOtp] = useState<string | null>(null);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const startCooldown = () => {
    setCooldown(RESEND_COOLDOWN_SECONDS);
    const interval = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleRequestOtp = async () => {
    setError(null);
    if (!email.trim()) {
      setError("Enter your email");
      return;
    }
    setLoading(true);
    try {
      const result = await requestOTP(email.trim().toLowerCase());
      setStage("otp");
      setOtp(Array(OTP_LENGTH).fill(""));
      startCooldown();
      if (result.devOtp) setDevOtp(result.devOtp);
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send code");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...otp];
    next[index] = digit;
    setOtp(next);
    if (digit && index < OTP_LENGTH - 1) inputRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (
    index: number,
    e: KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === "Backspace" && !otp[index] && index > 0)
      inputRefs.current[index - 1]?.focus();
  };

  const handleOtpPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, OTP_LENGTH);
    if (!pasted) return;
    const next = Array(OTP_LENGTH).fill("");
    pasted.split("").forEach((d, i) => (next[i] = d));
    setOtp(next);
    inputRefs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
  };

  const handleVerifyOtp = async () => {
    setError(null);
    const code = otp.join("");
    if (code.length !== OTP_LENGTH) {
      setError("Enter the full 6-digit code");
      return;
    }
    setLoading(true);
    try {
      await verifyOTP(email.trim().toLowerCase(), code);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid or expired code");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <img
            src={logoImage}
            alt="Noesys Article Platform"
            className="h-20 w-20 rounded-lg"
          />
          <span className="font-semibold text-lg text-slate-900">
            Article Platform
          </span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          {stage === "email" ? (
            <>
              <h1 className="text-xl font-semibold text-slate-900">Sign in</h1>
              <p className="text-sm text-slate-500 mt-1 mb-6">
                Enter your email to receive a verification code.
              </p>

              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Email
              </label>
              <div className="relative">
                <Mail
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleRequestOtp()}
                  placeholder="you@company.com"
                  autoFocus
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              {error && <p className="text-sm text-red-600 mt-2">{error}</p>}

              <button
                onClick={handleRequestOtp}
                disabled={loading}
                className="w-full mt-5 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg py-2.5 transition-colors"
              >
                {loading && <Loader2 size={15} className="animate-spin" />}
                {loading ? "Sending code..." : "Continue with email"}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  setStage("email");
                  setError(null);
                }}
                className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4"
              >
                <ChevronLeft size={14} />
                Back
              </button>

              <h1 className="text-xl font-semibold text-slate-900">
                Enter verification code
              </h1>
              <p className="text-sm text-slate-500 mt-1 mb-6">
                We sent a 6-digit code to{" "}
                <span className="font-medium text-slate-700">{email}</span>
              </p>

              {devOtp && (
                <p className="text-xs text-indigo-600 bg-indigo-50 rounded-lg px-3 py-2 mb-4">
                  Dev code: <strong>{devOtp}</strong>
                </p>
              )}

              <div
                className="flex justify-between gap-2"
                onPaste={handleOtpPaste}
              >
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => (inputRefs.current[i] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    className="w-11 h-12 text-center text-lg font-semibold rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                ))}
              </div>

              {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

              <button
                onClick={handleVerifyOtp}
                disabled={loading}
                className="w-full mt-5 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg py-2.5 transition-colors"
              >
                {loading && <Loader2 size={15} className="animate-spin" />}
                {loading ? "Verifying..." : "Verify & sign in"}
              </button>

              <div className="text-center mt-4">
                {cooldown > 0 ? (
                  <span className="text-xs text-slate-400">
                    Resend code in {cooldown}s
                  </span>
                ) : (
                  <button
                    onClick={handleRequestOtp}
                    disabled={loading}
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-700 disabled:opacity-60"
                  >
                    Resend code
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
