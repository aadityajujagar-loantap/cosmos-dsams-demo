'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import {
  Building2,
  ShieldCheck,
  Smartphone,
  User,
  Banknote,
  Check,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  Lock,
  ChevronRight,
  AlertTriangle,
  Building,
  CheckCircle,
  HelpCircle
} from 'lucide-react';
import { fetchPublicTokenInfo, submitCustomerLeadPublic, sendLeadOtp, verifyLeadOtp, LeadData } from '@/apis/lead';
import { fetchLoanProducts, fetchLoanTypesByProduct, getMasterValues, verifyPanAdvance, fetchBranchesDropdown } from '@/apis/admin';
import { getLoanPurposeOptionsFromApi } from '@/lib/loan-purpose';
import { formatCurrency } from '@/lib/utils';
import { withBasePath } from '@/lib/base-path';

export default function CustomerSelfFillPage() {
  const params = useParams();
  const token = params?.token as string;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [tokenInfo, setTokenInfo] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<any>(null);

  // PAN Verification State
  const [verifyingPan, setVerifyingPan] = useState(false);
  const [panVerified, setPanVerified] = useState(false);
  const [panMessage, setPanMessage] = useState<string | null>(null);

  // Mobile OTP State
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpReferenceId, setOtpReferenceId] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [otpMessage, setOtpMessage] = useState<string | null>(null);

  // Dynamic dropdown LOVs
  const [products, setProducts] = useState<any[]>([]);
  const [loanTypes, setLoanTypes] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [titles, setTitles] = useState<any[]>([]);
  const [genders, setGenders] = useState<any[]>([]);
  const [employmentTypes, setEmploymentTypes] = useState<any[]>([]);
  const [occupationTypes, setOccupationTypes] = useState<any[]>([]);
  const [loanPurposes, setLoanPurposes] = useState<any[]>([]);

  // Form State
  const [constitution, setConstitution] = useState<'Individual' | 'Non-Individual'>('Individual');
  const [formData, setFormData] = useState<Partial<LeadData>>({
    constitution: 'Individual',
    pincode: '400001',
    city: 'Mumbai',
    state: 'Maharashtra',
    Branch_id: '',
    pan_no: '',
    title: 'MR',
    first_name: '',
    middle_name: '',
    last_name: '',
    gender: 'MALE',
    dob: '',
    age: undefined,
    mobile: '',
    email: '',
    address: '',
    employment_type: '',
    occupation_type: '',
    employer_business_name: '',
    avg_gross_monthly_income: undefined,
    avg_net_monthly_income: undefined,
    existing_monthly_repayment_obligation: undefined,
    entity_name: '',
    doi: '',
    business_address: '',
    proprietor_partner_director_name: '',
    avg_annual_gross_income: undefined,
    avg_annual_net_income: undefined,
    annual_gross_turnover_last_fy: undefined,
    loan_product_id: undefined,
    loan_type_id: undefined,
    loan_purpose: '',
    loan_amount_required: 100000,
    loan_period_months: 12,
  });

  useEffect(() => {
    if (!token) return;

    const init = async () => {
      try {
        setLoading(true);
        const [tokenRes, prodRes, branchRes, titleRes, genderRes, empRes, occRes, purpRes] = await Promise.all([
          fetchPublicTokenInfo(token),
          fetchLoanProducts(),
          fetchBranchesDropdown(),
          getMasterValues({ group: 'title' }),
          getMasterValues({ group: 'gender' }),
          getMasterValues({ group: 'employment_type' }),
          getMasterValues({ group: 'occupation_type' }),
          getMasterValues({ group: 'loan_purpose' }),
        ]);

        if (tokenRes?.status === 'success') {
          setTokenInfo(tokenRes.data);
        } else {
          setError(tokenRes?.message || 'Invalid token');
        }

        const productItems = prodRes?.data?.data || prodRes?.data || prodRes || [];
        setProducts(Array.isArray(productItems) ? productItems : []);

        const branchItems = branchRes?.data || branchRes || [];
        setBranches(Array.isArray(branchItems) ? branchItems : []);

        setTitles(Array.isArray(titleRes?.data || titleRes) ? (titleRes?.data || titleRes) : []);
        setGenders(Array.isArray(genderRes?.data || genderRes) ? (genderRes?.data || genderRes) : []);
        setEmploymentTypes(Array.isArray(empRes?.data || empRes) ? (empRes?.data || empRes) : []);
        setOccupationTypes(Array.isArray(occRes?.data || occRes) ? (occRes?.data || occRes) : []);
        setLoanPurposes(Array.isArray(purpRes?.data || purpRes) ? (purpRes?.data || purpRes) : []);

      } catch (err: any) {
        setError(err?.response?.data?.message || err?.message || 'Failed to load link.');
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [token]);

  // Handle Product selection & Loan types
  const handleProductChange = async (productId: number) => {
    setFormData((prev) => ({ ...prev, loan_product_id: productId, loan_type_id: undefined }));
    if (!productId) {
      setLoanTypes([]);
      return;
    }
    try {
      const res = await fetchLoanTypesByProduct(productId);
      const types = res?.data || res || [];
      setLoanTypes(Array.isArray(types) ? types : []);
    } catch (err) {
      console.error('Failed to fetch loan types', err);
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      if (field === 'dob' && value) {
        const birthDate = new Date(value);
        if (!isNaN(birthDate.getTime())) {
          const today = new Date();
          let calculatedAge = today.getFullYear() - birthDate.getFullYear();
          const monthDiff = today.getMonth() - birthDate.getMonth();
          if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            calculatedAge--;
          }
          updated.age = calculatedAge;
        }
      }
      return updated;
    });
  };

  // PAN Verification Handler
  const handleVerifyPan = async () => {
    const pan = (formData.pan_no || '').trim().toUpperCase();
    if (!pan || pan.length !== 10) {
      setPanMessage('Please enter a valid 10-character PAN number.');
      setPanVerified(false);
      return;
    }

    try {
      setVerifyingPan(true);
      setPanMessage(null);
      const res = await verifyPanAdvance(pan);

      const detailsData = res?.data?.details?.data || res?.data?.details || res?.data || {};
      const statusSuccess = res?.success || res?.data?.status === 'SUCCESS';

      if (statusSuccess) {
        setPanVerified(true);
        setPanMessage('✓ PAN verified successfully. Details pre-filled below.');

        const firstName = detailsData.firstName || detailsData.first_name || '';
        const middleName = detailsData.middleName || detailsData.middle_name || '';
        const lastName = detailsData.lastName || detailsData.last_name || '';
        const fullName = detailsData.fullName || detailsData.name || `${firstName} ${middleName} ${lastName}`.trim();

        // DOB / DOI formatting
        let formattedDate = '';
        let calculatedAge = formData.age;
        const rawDob = detailsData.dobOrDoi || detailsData.dob || detailsData.doi;
        if (rawDob) {
          const d = new Date(rawDob);
          if (!isNaN(d.getTime())) {
            formattedDate = d.toISOString().split('T')[0];
            const today = new Date();
            calculatedAge = today.getFullYear() - d.getFullYear();
            const m = today.getMonth() - d.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < d.getDate())) {
              calculatedAge--;
            }
          } else {
            formattedDate = rawDob;
          }
        }

        let genderVal = (detailsData.gender || 'MALE').toUpperCase();
        if (genderVal.startsWith('M')) genderVal = 'MALE';
        else if (genderVal.startsWith('F')) genderVal = 'FEMALE';
        else if (genderVal.startsWith('T')) genderVal = 'TRANSGENDER';

        const addrParts = [
          detailsData.buildingName,
          detailsData.streetName,
          detailsData.locality,
          detailsData.city,
          detailsData.state,
          detailsData.pinCode,
        ].filter(Boolean);
        const fullAddress = addrParts.join(', ') || detailsData.address || '';

        const cityName = detailsData.city || 'Mumbai';
        const stateName = detailsData.state || 'Maharashtra';
        const pinCodeVal = detailsData.pinCode || detailsData.pincode || '400001';

        setFormData((prev) => ({
          ...prev,
          pan_no: pan,
          first_name: firstName || prev.first_name,
          middle_name: middleName || prev.middle_name,
          last_name: lastName || prev.last_name,
          entity_name: fullName || prev.entity_name,
          dob: formattedDate || prev.dob,
          doi: formattedDate || prev.doi,
          age: calculatedAge,
          gender: genderVal || prev.gender,
          address: fullAddress || prev.address,
          business_address: fullAddress || prev.business_address,
          city: cityName,
          state: stateName,
          pincode: pinCodeVal,
        }));
      } else {
        setPanVerified(false);
        setPanMessage(res?.message || 'PAN Verification returned invalid status.');
      }
    } catch (err: any) {
      setPanVerified(false);
      setPanMessage(err?.response?.data?.message || err?.message || 'PAN Verification failed.');
    } finally {
      setVerifyingPan(false);
    }
  };

  // Mobile OTP Handlers
  const handleSendOtp = async () => {
    const mobile = (formData.mobile || '').trim();
    if (!mobile || mobile.length !== 10) {
      setOtpMessage('Please enter a valid 10-digit mobile number.');
      return;
    }

    try {
      setSendingOtp(true);
      setOtpMessage(null);
      const res = await sendLeadOtp(mobile);
      if (res?.status === 'success') {
        setOtpSent(true);
        setOtpReferenceId(res.data?.reference_id || 'mock-ref-id');
        setOtpMessage(`OTP sent successfully! (Dev/UAT Mock OTP: ${res.data?.mock_otp || '123456'})`);
      } else {
        setOtpMessage(res?.message || 'Failed to send OTP.');
      }
    } catch (err: any) {
      setOtpMessage(err?.response?.data?.message || err?.message || 'Failed to send OTP.');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpReferenceId || !otpCode || otpCode.length !== 6) {
      setOtpMessage('Please enter 6-digit OTP code.');
      return;
    }

    try {
      setVerifyingOtp(true);
      setOtpMessage(null);
      const res = await verifyLeadOtp(otpReferenceId, otpCode);
      if (res?.status === 'success') {
        setOtpVerified(true);
        setOtpMessage('✓ Mobile OTP Verified successfully.');
      } else {
        setOtpMessage(res?.message || 'Invalid OTP entered.');
      }
    } catch (err: any) {
      setOtpMessage(err?.response?.data?.message || err?.message || 'OTP verification failed.');
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.loan_product_id || !formData.loan_type_id) {
      setError('Please select Loan Product and Loan Type.');
      return;
    }
    if (!formData.mobile || formData.mobile.length !== 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }
    if (!otpVerified) {
      setError('Please verify your Mobile OTP before submitting.');
      return;
    }
    if (!formData.pan_no || formData.pan_no.length !== 10) {
      setError('Please enter a valid 10-character PAN Number.');
      return;
    }
    if (constitution === 'Individual' && formData.age !== undefined && (formData.age < 18 || formData.age > 70)) {
      setError(`Applicant age must be between 18 and 70 years. Current calculated age: ${formData.age}`);
      return;
    }

    try {
      setSubmitting(true);
      const payload: LeadData = {
        ...formData,
        constitution,
        loan_product_id: Number(formData.loan_product_id),
        loan_type_id: Number(formData.loan_type_id),
        loan_amount_required: Number(formData.loan_amount_required),
        loan_period_months: Number(formData.loan_period_months),
        mobile: formData.mobile!,
        pan_no: formData.pan_no!.toUpperCase(),
      };

      const res = await submitCustomerLeadPublic(token, payload);
      if (res?.status === 'success') {
        setSuccess(res.data);
      } else {
        setError(res?.message || 'Failed to submit application.');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Error submitting form.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col items-center justify-center p-4">
        <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-xl flex flex-col items-center gap-4 text-center max-w-sm w-full">
          <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100">
            <RefreshCw className="h-8 w-8 animate-spin" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base">Loading Loan Application</h3>
            <p className="text-xs text-slate-500 mt-1">Initializing Cosmos Bank portal & live scheme parameters...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && !tokenInfo) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border border-rose-200 rounded-3xl p-8 text-center shadow-xl space-y-4">
          <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto border border-rose-100">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Invalid or Expired Link</h2>
            <p className="text-slate-500 text-xs mt-2 leading-relaxed">{error}</p>
          </div>
          <div className="pt-2 text-[11px] text-slate-400 font-mono">
            Please contact your empanelled DSA partner for a fresh application link.
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col items-center justify-center p-4">
        {/* Cosmos Brand Header */}
        <div className="fixed top-0 left-0 right-0 bg-white border-b border-slate-200 px-6 py-3.5 shadow-xs flex items-center justify-between z-50">
          <div className="flex items-center gap-3">
            <Image
              src={withBasePath('/logo-dsasm-cosmos.png')}
              alt="Cosmos Bank Logo"
              width={220}
              height={40}
              className="h-8 w-auto object-contain"
              priority
              unoptimized
            />
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
            <ShieldCheck className="h-3.5 w-3.5" /> 256-Bit SSL Encrypted
          </div>
        </div>

        <div className="max-w-lg w-full bg-white border border-slate-200 rounded-3xl p-8 text-center shadow-2xl space-y-6 mt-16">
          <div className="w-16 h-16 bg-gradient-to-tr from-emerald-600 to-teal-500 text-white rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-emerald-600/20">
            <CheckCircle2 className="h-9 w-9" />
          </div>

          <div>
            <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] uppercase font-bold px-3.5 py-1 rounded-full tracking-wider">
              Application Submitted
            </span>
            <h2 className="text-2xl font-black text-slate-900 mt-3">Loan Request Registered</h2>
            <p className="text-slate-600 text-xs mt-2">
              Thank you! Your loan application has been registered via referral partner{' '}
              <span className="font-bold text-indigo-700">{tokenInfo?.dsa?.name || 'DSA Partner'}</span>.
            </p>
          </div>

          <div className="bg-slate-50 rounded-2xl p-4 text-left border border-slate-200 space-y-3 font-mono text-xs shadow-xs">
            <div className="flex justify-between items-center border-b border-slate-200 pb-2">
              <span className="text-slate-500 font-sans">Application Reference</span>
              <span className="text-indigo-700 font-bold tracking-wider">{success.application_id || success.lead_uuid}</span>
            </div>
            <div className="flex justify-between items-center border-b border-slate-200 pb-2">
              <span className="text-slate-500 font-sans">Status</span>
              <span className="bg-amber-100 text-amber-800 border border-amber-200 font-sans font-bold px-2.5 py-0.5 rounded text-[10px]">
                {success.status || 'NEW'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-sans">Submitted On</span>
              <span className="text-slate-700 font-sans text-[11px]">{new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
            </div>
          </div>

          <div className="bg-indigo-50/60 p-4 rounded-2xl border border-indigo-100 text-left space-y-2 text-xs">
            <p className="font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-indigo-600" />
              What Happens Next?
            </p>
            <ul className="text-slate-600 text-[11px] space-y-1.5 list-disc list-inside">
              <li>Our Bank Processing Team will review your application details.</li>
              <li>You will receive SMS/E-mail updates on your registered mobile number.</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16">
      
      {/* Cosmos Official Brand Top Bar */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs px-4 sm:px-8 py-3.5">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src={withBasePath('/logo-dsasm-cosmos.png')}
              alt="Cosmos Co-operative Bank Logo"
              width={708}
              height={118}
              className="h-9 sm:h-10 w-auto object-contain"
              priority
              unoptimized
            />
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200">
              <Lock className="h-3.5 w-3.5" /> 256-Bit SSL Encrypted
            </div>
            {tokenInfo?.dsa && (
              <div className="text-right">
                <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Channel Code</span>
                <span className="font-mono text-xs font-extrabold text-indigo-900 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-md">
                  {tokenInfo.dsa.dsa_code || 'DSA_PARTNER'}
                </span>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto pt-6 sm:pt-8 px-4 sm:px-6">
        
        {/* Hero Banner Card (Matches Indigo Theme) */}
        <div className="bg-gradient-to-tr from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden mb-6">
          <div className="absolute -top-24 -left-24 w-72 h-72 bg-indigo-600/30 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-sky-500/20 rounded-full blur-3xl" />

          <div className="relative z-10 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="bg-white/10 border border-white/20 backdrop-blur-md text-white font-bold text-[10px] px-3 py-1 rounded-full uppercase tracking-wider">
                Official DSA Lead Portal
              </span>
              <span className="text-xs text-slate-300">
                Referred by Partner: <strong className="text-sky-300">{tokenInfo?.dsa?.name || 'Empowered DSA Partner'}</strong>
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight leading-snug">
              Customer Loan <span className="text-sky-300">Application Portal</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Complete your digital loan request in simple steps. Enjoy instant identity auto-fill via official PAN verification and direct Cosmos Bank processing.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2 text-[11px] text-slate-300 border-t border-slate-800/80">
              <div className="flex items-center gap-1.5 font-medium">
                <CheckCircle className="h-3.5 w-3.5 text-sky-400" /> Instant PAN Auto-Fill
              </div>
              <div className="flex items-center gap-1.5 font-medium">
                <CheckCircle className="h-3.5 w-3.5 text-emerald-400" /> Mobile OTP Verification
              </div>
              <div className="flex items-center gap-1.5 font-medium">
                <CheckCircle className="h-3.5 w-3.5 text-indigo-400" /> Direct Bank Branch Routing
              </div>
            </div>
          </div>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="mb-6 bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-2xl text-xs font-semibold flex items-center gap-3 shadow-xs">
            <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Main Application Form Container */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 shadow-xl space-y-8">
          <form onSubmit={handleSubmit} className="space-y-8">
            
            {/* SECTION 1: Branch Location & Constitution */}
            <div className="bg-slate-50/80 border border-slate-200/90 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    1. Preferred Branch Location & Constitution
                  </h3>
                </div>
                <span className="text-[10px] text-slate-400 font-bold uppercase">Step 1 of 5</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-slate-700 font-bold mb-1.5 uppercase tracking-wider text-[11px]">
                    Select Preferred Branch *
                  </label>
                  <select
                    required
                    value={formData.Branch_id || ''}
                    onChange={(e) => handleChange('Branch_id', e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 transition-all font-medium shadow-xs"
                  >
                    <option value="">-- Select Preferred Cosmos Branch --</option>
                    {branches.map((b) => (
                      <option key={b.branch_code || b.id} value={b.branch_code || b.id}>
                        {b.branch_name || b.name} ({b.branch_code || b.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1.5 uppercase tracking-wider text-[11px]">
                    Constitution Type *
                  </label>
                  <select
                    required
                    value={formData.constitution || 'Individual'}
                    onChange={(e) => {
                      const val = e.target.value;
                      const isInd = (val === 'Individual' || val === 'Individual Applicant');
                      setConstitution(isInd ? 'Individual' : (val as any));
                      handleChange('constitution', val);
                    }}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 transition-all font-medium shadow-xs"
                  >
                    <option value="Individual">Individual Applicant</option>
                    <option value="Proprietory">Proprietory Firm</option>
                    <option value="Partnership">Partnership Firm</option>
                    <option value="Limited Liability Partnership">Limited Liability Partnership (LLP)</option>
                    <option value="Pvt. Ltd. Company">Pvt. Ltd. Company</option>
                    <option value="Public Ltd. Company">Public Ltd. Company</option>
                    <option value="Charitable Trust">Charitable Trust</option>
                    <option value="Co-op. Society">Co-op. Society</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="block text-slate-700 font-bold mb-1.5 uppercase tracking-wider text-[11px]">Pincode *</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    placeholder="e.g. 400001"
                    value={formData.pincode || ''}
                    onChange={(e) => handleChange('pincode', e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 font-mono focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1.5 uppercase tracking-wider text-[11px]">City *</label>
                  <input
                    type="text"
                    required
                    placeholder="City"
                    value={formData.city || ''}
                    onChange={(e) => handleChange('city', e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 transition-all font-medium shadow-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1.5 uppercase tracking-wider text-[11px]">State *</label>
                  <input
                    type="text"
                    required
                    placeholder="State"
                    value={formData.state || ''}
                    onChange={(e) => handleChange('state', e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 transition-all font-medium shadow-xs"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 2: Identity & PAN Verification */}
            <div className="bg-emerald-50/50 border border-emerald-200 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs">
              <div className="flex items-center justify-between border-b border-emerald-200/80 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl border border-emerald-200">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-950">
                    2. Instant Identity Verification (PAN API)
                  </h3>
                </div>
                {panVerified && (
                  <span className="bg-emerald-600 text-white font-bold text-[10px] px-2.5 py-0.5 rounded-full shadow-xs">
                    ✓ Verified
                  </span>
                )}
              </div>

              <div className="space-y-3">
                <label className="block text-slate-700 font-bold text-xs uppercase tracking-wider">
                  {constitution === 'Individual' ? 'Individual PAN Number *' : 'Entity PAN Number *'}
                </label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    required
                    maxLength={10}
                    placeholder="ABCDE1234F"
                    value={formData.pan_no || ''}
                    onChange={(e) => {
                      handleChange('pan_no', e.target.value.toUpperCase());
                      setPanVerified(false);
                      setPanMessage(null);
                    }}
                    className="flex-1 bg-white border border-emerald-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 font-mono font-bold shadow-xs"
                  />
                  <button
                    type="button"
                    disabled={verifyingPan || (formData.pan_no || '').length !== 10}
                    onClick={handleVerifyPan}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-all shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {verifyingPan ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Verifying...
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="h-3.5 w-3.5" /> Verify & Auto-Fill
                      </>
                    )}
                  </button>
                </div>

                {panMessage && (
                  <p className={`text-xs p-3 rounded-xl border font-medium ${panVerified ? 'bg-emerald-100/70 border-emerald-300 text-emerald-900' : 'bg-amber-100/70 border-amber-300 text-amber-900'}`}>
                    {panMessage}
                  </p>
                )}
              </div>
            </div>

            {/* SECTION 3: Mobile OTP Authentication */}
            <div className="bg-slate-50/80 border border-slate-200/90 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
                    <Smartphone className="h-4 w-4" />
                  </div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    3. Mobile OTP Authentication
                  </h3>
                </div>
                <span className="text-[10px] text-slate-400 font-bold uppercase">Step 3 of 5</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-slate-700 font-bold mb-1.5 uppercase tracking-wider text-[11px]">Mobile Number *</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      maxLength={10}
                      placeholder="10-digit mobile"
                      disabled={otpVerified}
                      value={formData.mobile || ''}
                      onChange={(e) => {
                        handleChange('mobile', e.target.value);
                        setOtpSent(false);
                        setOtpVerified(false);
                      }}
                      className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 font-mono focus:outline-none focus:border-indigo-600 shadow-xs disabled:opacity-60"
                    />
                    {!otpVerified && (
                      <button
                        type="button"
                        disabled={sendingOtp || (formData.mobile || '').length !== 10}
                        onClick={handleSendOtp}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-md shadow-indigo-600/20 disabled:opacity-50"
                      >
                        {sendingOtp ? 'Sending...' : 'Send OTP'}
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1.5 uppercase tracking-wider text-[11px]">E-Mail Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="email@domain.com"
                    value={formData.email || ''}
                    onChange={(e) => handleChange('email', e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-600 transition-all font-medium shadow-xs"
                  />
                </div>
              </div>

              {/* OTP Code Entry Card */}
              {otpSent && !otpVerified && (
                <div className="border-t border-slate-200 pt-4 space-y-3">
                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <input
                      type="text"
                      maxLength={6}
                      placeholder="Enter 6-digit OTP (e.g. 123456)"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      className="w-full sm:w-64 bg-white border border-indigo-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 font-mono tracking-widest text-center focus:outline-none focus:border-indigo-600 font-bold shadow-xs"
                    />
                    <button
                      type="button"
                      disabled={verifyingOtp || otpCode.length !== 6}
                      onClick={handleVerifyOtp}
                      className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-6 py-2.5 rounded-xl transition-all shadow-md shadow-emerald-600/20 disabled:opacity-50"
                    >
                      {verifyingOtp ? 'Verifying...' : 'Verify OTP'}
                    </button>
                  </div>
                </div>
              )}

              {otpVerified && (
                <div className="bg-emerald-100/70 border border-emerald-300 text-emerald-900 p-3 rounded-xl text-xs font-bold flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-700" />
                  <span>Mobile Number Verified Successfully</span>
                </div>
              )}

              {otpMessage && !otpVerified && (
                <p className="text-xs text-amber-900 bg-amber-100/70 border border-amber-300 p-2.5 rounded-xl font-medium">
                  {otpMessage}
                </p>
              )}
            </div>

            {/* SECTION 4: Applicant Details (Individual vs Non-Individual) */}
            {constitution === 'Individual' ? (
              <div className="bg-slate-50/80 border border-slate-200/90 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
                      <User className="h-4 w-4" />
                    </div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                      4. Personal & Income Profile
                    </h3>
                  </div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Step 4 of 5</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1.5 uppercase tracking-wider text-[11px]">Title *</label>
                    <select
                      value={formData.title || 'MR'}
                      onChange={(e) => handleChange('title', e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-600 font-medium shadow-xs"
                    >
                      {titles.length > 0 ? (
                        titles.map((t: any) => (
                          <option key={t.meta_key || t.id} value={t.meta_key || t.meta_value}>
                            {t.meta_value}
                          </option>
                        ))
                      ) : (
                        <>
                          <option value="MR">Mr.</option>
                          <option value="MRS">Mrs.</option>
                          <option value="MS">Ms.</option>
                          <option value="DR">Dr.</option>
                        </>
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1.5 uppercase tracking-wider text-[11px]">First Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="First Name"
                      value={formData.first_name || ''}
                      onChange={(e) => handleChange('first_name', e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-600 font-medium shadow-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1.5 uppercase tracking-wider text-[11px]">Middle Name</label>
                    <input
                      type="text"
                      placeholder="Middle Name"
                      value={formData.middle_name || ''}
                      onChange={(e) => handleChange('middle_name', e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-600 font-medium shadow-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1.5 uppercase tracking-wider text-[11px]">Last Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="Last Name"
                      value={formData.last_name || ''}
                      onChange={(e) => handleChange('last_name', e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-600 font-medium shadow-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1.5 uppercase tracking-wider text-[11px]">Gender *</label>
                    <select
                      value={formData.gender || 'MALE'}
                      onChange={(e) => handleChange('gender', e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-600 font-medium shadow-xs"
                    >
                      {genders.length > 0 ? (
                        genders.map((g: any) => (
                          <option key={g.meta_key || g.id} value={g.meta_key || g.meta_value}>
                            {g.meta_value}
                          </option>
                        ))
                      ) : (
                        <>
                          <option value="MALE">Male</option>
                          <option value="FEMALE">Female</option>
                          <option value="TRANSGENDER">Transgender</option>
                        </>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1.5 uppercase tracking-wider text-[11px]">Date of Birth (DOB) *</label>
                    <input
                      type="date"
                      required
                      value={formData.dob || ''}
                      onChange={(e) => handleChange('dob', e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-600 font-medium shadow-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1.5 uppercase tracking-wider text-[11px]">Calculated Age</label>
                    <div className="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-indigo-900 font-bold font-mono flex items-center justify-between">
                      <span>{formData.age !== undefined ? `${formData.age} Years` : '--'}</span>
                      {formData.age !== undefined && (
                        <span className="bg-indigo-100 text-indigo-800 text-[10px] px-2 py-0.5 rounded font-bold">Auto</span>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1.5 uppercase tracking-wider text-[11px]">Residential Address *</label>
                  <textarea
                    rows={2}
                    required
                    value={formData.address || ''}
                    onChange={(e) => handleChange('address', e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-600 font-medium shadow-xs"
                    placeholder="Full residence address..."
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1.5 uppercase tracking-wider text-[11px]">Employment Type *</label>
                    <select
                      required
                      value={formData.employment_type || ''}
                      onChange={(e) => handleChange('employment_type', e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-600 font-medium shadow-xs"
                    >
                      <option value="">-- Select Employment Type --</option>
                      {employmentTypes.map((item: any) => (
                        <option key={item.meta_key || item.id} value={item.meta_key || item.meta_value}>
                          {item.meta_value}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1.5 uppercase tracking-wider text-[11px]">Occupation Type *</label>
                    <select
                      required
                      value={formData.occupation_type || ''}
                      onChange={(e) => handleChange('occupation_type', e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-600 font-medium shadow-xs"
                    >
                      <option value="">-- Select Occupation Type --</option>
                      {occupationTypes.map((item: any) => (
                        <option key={item.meta_key || item.id} value={item.meta_key || item.meta_value}>
                          {item.meta_value}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1.5 uppercase tracking-wider text-[11px]">Employer / Business Entity Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="Company / Employer name"
                    value={formData.employer_business_name || ''}
                    onChange={(e) => handleChange('employer_business_name', e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-600 font-medium shadow-xs"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1.5 uppercase tracking-wider text-[11px]">Avg Gross Monthly Income (₹) *</label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={formData.avg_gross_monthly_income || ''}
                      onChange={(e) => handleChange('avg_gross_monthly_income', e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-600 font-mono font-bold shadow-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1.5 uppercase tracking-wider text-[11px]">Avg Net Monthly Income (₹) *</label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={formData.avg_net_monthly_income || ''}
                      onChange={(e) => handleChange('avg_net_monthly_income', e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-600 font-mono font-bold shadow-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1.5 uppercase tracking-wider text-[11px]">Monthly Obligation (₹) *</label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={formData.existing_monthly_repayment_obligation || ''}
                      onChange={(e) => handleChange('existing_monthly_repayment_obligation', e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-600 font-mono font-bold shadow-xs"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50/80 border border-slate-200/90 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
                      <Building className="h-4 w-4" />
                    </div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                      4. Entity Profile (Non-Individual)
                    </h3>
                  </div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Step 4 of 5</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1.5 uppercase tracking-wider text-[11px]">Entity Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="Registered Legal Entity Name"
                      value={formData.entity_name || ''}
                      onChange={(e) => handleChange('entity_name', e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-600 font-medium shadow-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1.5 uppercase tracking-wider text-[11px]">Date of Incorporation (DOI) *</label>
                    <input
                      type="date"
                      required
                      value={formData.doi || ''}
                      onChange={(e) => handleChange('doi', e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-600 font-medium shadow-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1.5 uppercase tracking-wider text-[11px]">Business Address *</label>
                  <textarea
                    rows={2}
                    required
                    placeholder="Full office address..."
                    value={formData.business_address || ''}
                    onChange={(e) => handleChange('business_address', e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-600 font-medium shadow-xs"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1.5 uppercase tracking-wider text-[11px]">Proprietor / Partner / Director Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="Key promoter name"
                      value={formData.proprietor_partner_director_name || ''}
                      onChange={(e) => handleChange('proprietor_partner_director_name', e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-600 font-medium shadow-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1.5 uppercase tracking-wider text-[11px]">Annual Gross Turnover Last FY (₹) *</label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={formData.annual_gross_turnover_last_fy || ''}
                      onChange={(e) => handleChange('annual_gross_turnover_last_fy', e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-600 font-mono font-bold shadow-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1.5 uppercase tracking-wider text-[11px]">Avg Annual Gross Income (₹) *</label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={formData.avg_annual_gross_income || ''}
                      onChange={(e) => handleChange('avg_annual_gross_income', e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-600 font-mono font-bold shadow-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1.5 uppercase tracking-wider text-[11px]">Avg Annual Net Income (₹) *</label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={formData.avg_annual_net_income || ''}
                      onChange={(e) => handleChange('avg_annual_net_income', e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-600 font-mono font-bold shadow-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1.5 uppercase tracking-wider text-[11px]">Monthly Obligation (₹) *</label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={formData.existing_monthly_repayment_obligation || ''}
                      onChange={(e) => handleChange('existing_monthly_repayment_obligation', e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-600 font-mono font-bold shadow-xs"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 5: Loan Requirements */}
            <div className="bg-slate-50/80 border border-slate-200/90 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
                    <Banknote className="h-4 w-4" />
                  </div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    5. Loan Requirement & Product Scheme
                  </h3>
                </div>
                <span className="text-[10px] text-slate-400 font-bold uppercase">Step 5 of 5</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="block text-slate-700 font-bold mb-1.5 uppercase tracking-wider text-[11px]">Loan Product *</label>
                  <select
                    required
                    value={formData.loan_product_id || ''}
                    onChange={(e) => handleProductChange(Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-600 font-medium shadow-xs"
                  >
                    <option value="">-- Select Loan Product --</option>
                    {products
                      .filter((p) => {
                        if (constitution !== 'Individual') {
                          const nameLower = (p.name || p.product_name || '').toLowerCase();
                          if (nameLower.includes('home loan') || nameLower.includes('education loan')) {
                            return false;
                          }
                        }
                        return true;
                      })
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name || p.product_name}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1.5 uppercase tracking-wider text-[11px]">Loan Type *</label>
                  <select
                    required
                    disabled={!formData.loan_product_id}
                    value={formData.loan_type_id || ''}
                    onChange={(e) => handleChange('loan_type_id', Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-600 disabled:opacity-50 font-medium shadow-xs"
                  >
                    <option value="">-- Select Loan Type --</option>
                    {loanTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name || t.type_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1.5 uppercase tracking-wider text-[11px]">Loan Purpose *</label>
                  <select
                    required
                    disabled={!formData.loan_product_id}
                    value={formData.loan_purpose || ''}
                    onChange={(e) => handleChange('loan_purpose', e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-600 disabled:opacity-50 font-medium shadow-xs"
                  >
                    <option value="">-- Select Purpose --</option>
                    {getLoanPurposeOptionsFromApi(
                      loanPurposes,
                      products.find((p) => Number(p.id) === Number(formData.loan_product_id))?.name ||
                      products.find((p) => Number(p.id) === Number(formData.loan_product_id))?.product_name,
                      loanTypes.find((t) => Number(t.id) === Number(formData.loan_type_id))?.name ||
                      loanTypes.find((t) => Number(t.id) === Number(formData.loan_type_id))?.type_name
                    ).map((purp, idx) => (
                      <option key={idx} value={purp}>{purp}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-slate-700 font-bold mb-1.5 uppercase tracking-wider text-[11px]">
                    Loan Amount Required (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    min={1000}
                    placeholder="e.g. 500000"
                    value={formData.loan_amount_required || ''}
                    onChange={(e) => handleChange('loan_amount_required', e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-indigo-600 font-mono font-bold shadow-xs"
                  />
                  {formData.loan_amount_required && Number(formData.loan_amount_required) > 0 && (
                    <p className="text-[11px] text-indigo-700 font-mono mt-1 font-bold">
                      Amount: {formatCurrency(Number(formData.loan_amount_required))}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1.5 uppercase tracking-wider text-[11px]">Loan Period (Months) *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={360}
                    value={formData.loan_period_months || 12}
                    onChange={(e) => handleChange('loan_period_months', e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-indigo-600 font-mono font-bold shadow-xs"
                  />
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting || !otpVerified}
              className="w-full bg-gradient-to-r from-indigo-600 via-indigo-700 to-blue-700 hover:from-indigo-500 hover:to-blue-600 text-white font-extrabold text-sm py-4 px-6 rounded-2xl shadow-lg shadow-indigo-600/25 transition-all hover:scale-[1.005] active:scale-[0.995] flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {submitting ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" /> Submitting Application...
                </>
              ) : (
                <>
                  Submit Loan Application <ChevronRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
