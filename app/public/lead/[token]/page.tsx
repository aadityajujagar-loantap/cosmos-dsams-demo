'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { fetchPublicTokenInfo, submitCustomerLeadPublic, LeadData } from '@/apis/lead';
import { fetchLoanProducts, fetchLoanTypesByProduct, getMasterValues, verifyPanAdvance } from '@/apis/admin';

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

  // Dynamic dropdown LOVs
  const [products, setProducts] = useState<any[]>([]);
  const [loanTypes, setLoanTypes] = useState<any[]>([]);
  const [titles, setTitles] = useState<any[]>([]);
  const [genders, setGenders] = useState<any[]>([]);
  const [employmentTypes, setEmploymentTypes] = useState<any[]>([]);
  const [occupationTypes, setOccupationTypes] = useState<any[]>([]);
  const [propertyCategories, setPropertyCategories] = useState<any[]>([]);

  // Form State
  const [constitution, setConstitution] = useState<'Individual' | 'Non-Individual'>('Individual');
  const [formData, setFormData] = useState<Partial<LeadData>>({
    constitution: 'Individual',
    mobile: '',
    email: '',
    pan_no: '',
    first_name: '',
    middle_name: '',
    last_name: '',
    title: 'MR',
    gender: 'MALE',
    dob: '',
    address: '',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400001',
    employment_type: '',
    occupation_type: '',
    employer_business_name: '',
    avg_gross_monthly_income: undefined,
    avg_net_monthly_income: undefined,
    entity_name: '',
    doi: '',
    business_address: '',
    proprietor_partner_director_name: '',
    avg_annual_gross_income: undefined,
    avg_annual_net_income: undefined,
    annual_gross_turnover_last_fy: undefined,
    existing_monthly_repayment_obligation: undefined,
    loan_product_id: undefined,
    loan_type_id: undefined,
    loan_amount_required: 100000,
    loan_period_months: 12,
  });

  useEffect(() => {
    if (!token) return;

    const init = async () => {
      try {
        setLoading(true);
        const [tokenRes, prodRes, titleRes, genderRes, empRes, occRes, propRes] = await Promise.all([
          fetchPublicTokenInfo(token),
          fetchLoanProducts(),
          getMasterValues({ group: 'title' }),
          getMasterValues({ group: 'gender' }),
          getMasterValues({ group: 'employment_type' }),
          getMasterValues({ group: 'occupation_type' }),
          getMasterValues({ group: 'property_category' }),
        ]);

        if (tokenRes?.status === 'success') {
          setTokenInfo(tokenRes.data);
        } else {
          setError(tokenRes?.message || 'Invalid token');
        }

        const productItems = prodRes?.data?.data || prodRes?.data || prodRes || [];
        setProducts(Array.isArray(productItems) ? productItems : []);

        setTitles(Array.isArray(titleRes?.data || titleRes) ? (titleRes?.data || titleRes) : []);
        setGenders(Array.isArray(genderRes?.data || genderRes) ? (genderRes?.data || genderRes) : []);
        setEmploymentTypes(Array.isArray(empRes?.data || empRes) ? (empRes?.data || empRes) : []);
        setOccupationTypes(Array.isArray(occRes?.data || occRes) ? (occRes?.data || occRes) : []);
        setPropertyCategories(Array.isArray(propRes?.data || propRes) ? (propRes?.data || propRes) : []);

      } catch (err: any) {
        setError(err?.response?.data?.message || err?.message || 'Failed to load link.');
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [token]);

  // When product changes, fetch corresponding loan types
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
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // PAN Verification & Pre-filling Handler
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
        const rawDob = detailsData.dobOrDoi || detailsData.dob || detailsData.doi;
        if (rawDob) {
          const d = new Date(rawDob);
          if (!isNaN(d.getTime())) {
            formattedDate = d.toISOString().split('T')[0];
          } else {
            formattedDate = rawDob;
          }
        }

        // Gender mapping
        let genderVal = (detailsData.gender || 'MALE').toUpperCase();
        if (genderVal.startsWith('M')) genderVal = 'MALE';
        else if (genderVal.startsWith('F')) genderVal = 'FEMALE';
        else if (genderVal.startsWith('T')) genderVal = 'TRANSGENDER';

        // Address concatenation
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
    if (!formData.pan_no || formData.pan_no.length !== 10) {
      setError('Please enter a valid 10-character PAN Number.');
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
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (error && !tokenInfo) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-xl p-6 text-center shadow-xl">
          <div className="text-red-400 text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold mb-2">Invalid or Expired Link</h2>
          <p className="text-slate-400 text-sm mb-6">{error}</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-slate-800 border border-slate-700 rounded-xl p-8 text-center shadow-2xl">
          <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl font-bold">
            ✓
          </div>
          <h2 className="text-2xl font-bold text-emerald-400 mb-2">Application Submitted!</h2>
          <p className="text-slate-300 mb-6">
            Thank you for submitting your loan application with <span className="font-semibold text-white">{tokenInfo?.dsa?.name}</span>.
          </p>
          <div className="bg-slate-900/80 rounded-lg p-4 mb-6 text-left border border-slate-700 font-mono text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-400">Application Reference:</span>
              <span className="text-emerald-400 font-bold">{success.application_id || success.lead_uuid}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Status:</span>
              <span className="text-amber-400 font-semibold">{success.status}</span>
            </div>
          </div>
          <p className="text-xs text-slate-400">Our representative will get in touch with you shortly.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-10 px-4 flex justify-center">
      <div className="max-w-3xl w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-10 shadow-2xl space-y-8">
        
        {/* Header */}
        <div className="border-b border-slate-800 pb-6 text-center sm:text-left flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Loan Application Portal</h1>
            <p className="text-slate-400 text-sm mt-1">
              Referred by: <span className="text-emerald-400 font-medium">{tokenInfo?.dsa?.name || 'DSA Partner'}</span>
            </p>
          </div>
          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs px-3 py-1.5 rounded-full font-medium">
            Self-Fill Application
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* STEP 1: Loan Product & Loan Type Selection */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
              1. Select Loan Product & Type
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Loan Product *</label>
                <select
                  required
                  value={formData.loan_product_id || ''}
                  onChange={(e) => handleProductChange(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="">-- Select Loan Product --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name || p.product_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Loan Type *</label>
                <select
                  required
                  disabled={!formData.loan_product_id}
                  value={formData.loan_type_id || ''}
                  onChange={(e) => handleChange('loan_type_id', Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 disabled:opacity-50"
                >
                  <option value="">-- Select Loan Type --</option>
                  {loanTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name || t.type_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* STEP 2: Constitution & Contact Information */}
          <div className="border-t border-slate-800 pt-6 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
              2. Constitution & Contact Information
            </h3>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-2">Applicant Constitution *</label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setConstitution('Individual');
                    handleChange('constitution', 'Individual');
                  }}
                  className={`py-3 px-4 rounded-xl border text-sm font-semibold transition ${
                    constitution === 'Individual'
                      ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-900/30'
                      : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  👤 Individual
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConstitution('Non-Individual');
                    handleChange('constitution', 'Non-Individual');
                  }}
                  className={`py-3 px-4 rounded-xl border text-sm font-semibold transition ${
                    constitution === 'Non-Individual'
                      ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-900/30'
                      : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  🏢 Entity / Business
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Mobile Number *</label>
                <input
                  type="text"
                  required
                  maxLength={10}
                  placeholder="10-digit mobile"
                  value={formData.mobile || ''}
                  onChange={(e) => handleChange('mobile', e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Email Address</label>
                <input
                  type="email"
                  placeholder="email@domain.com"
                  value={formData.email || ''}
                  onChange={(e) => handleChange('email', e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* STEP 3: PAN Verification (FIRST before Name/Address/DOB) */}
          <div className="border-t border-slate-800 pt-6 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
              3. Identity Verification (PAN Verification API)
            </h3>
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 space-y-3">
              <label className="block text-xs font-medium text-slate-300">
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
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white uppercase tracking-wider focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  disabled={verifyingPan || (formData.pan_no || '').length !== 10}
                  onClick={handleVerifyPan}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-5 py-2.5 rounded-xl transition flex items-center justify-center space-x-2 disabled:opacity-50"
                >
                  {verifyingPan ? (
                    <span>Verifying...</span>
                  ) : (
                    <span>🔍 Verify PAN & Pre-Fill</span>
                  )}
                </button>
              </div>

              {panMessage && (
                <p className={`text-xs mt-2 ${panVerified ? 'text-emerald-400 font-medium' : 'text-amber-400'}`}>
                  {panMessage}
                </p>
              )}
            </div>
          </div>

          {/* STEP 4: Applicant Details (Pre-filled from PAN) */}
          {constitution === 'Individual' ? (
            <div className="space-y-4 border-t border-slate-800 pt-6">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                4. Applicant Details (Auto-filled from PAN)
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Title</label>
                  <select
                    value={formData.title || 'MR'}
                    onChange={(e) => handleChange('title', e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
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
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">First Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.first_name || ''}
                    onChange={(e) => handleChange('first_name', e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Middle Name</label>
                  <input
                    type="text"
                    value={formData.middle_name || ''}
                    onChange={(e) => handleChange('middle_name', e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.last_name || ''}
                    onChange={(e) => handleChange('last_name', e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Date of Birth</label>
                  <input
                    type="date"
                    value={formData.dob || ''}
                    onChange={(e) => handleChange('dob', e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Gender</label>
                  <select
                    value={formData.gender || 'MALE'}
                    onChange={(e) => handleChange('gender', e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
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
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Residential Address</label>
                <textarea
                  rows={2}
                  value={formData.address || ''}
                  onChange={(e) => handleChange('address', e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  placeholder="Full residence address..."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Employment Type</label>
                  <select
                    value={formData.employment_type || ''}
                    onChange={(e) => handleChange('employment_type', e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
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
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Occupation Type</label>
                  <select
                    value={formData.occupation_type || ''}
                    onChange={(e) => handleChange('occupation_type', e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Gross Monthly Income (₹)</label>
                  <input
                    type="number"
                    value={formData.avg_gross_monthly_income || ''}
                    onChange={(e) => handleChange('avg_gross_monthly_income', e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Existing Monthly Obligation (₹)</label>
                  <input
                    type="number"
                    value={formData.existing_monthly_repayment_obligation || ''}
                    onChange={(e) => handleChange('existing_monthly_repayment_obligation', e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 border-t border-slate-800 pt-6">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                4. Business / Entity Details (Auto-filled from PAN)
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Entity / Firm Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.entity_name || ''}
                    onChange={(e) => handleChange('entity_name', e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Date of Incorporation (DOI)</label>
                  <input
                    type="date"
                    value={formData.doi || ''}
                    onChange={(e) => handleChange('doi', e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Business Address</label>
                <textarea
                  rows={2}
                  value={formData.business_address || ''}
                  onChange={(e) => handleChange('business_address', e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  placeholder="Full office/registered business address..."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Proprietor / Partner / Director Name</label>
                  <input
                    type="text"
                    value={formData.proprietor_partner_director_name || ''}
                    onChange={(e) => handleChange('proprietor_partner_director_name', e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Annual Gross Turnover Last FY (₹)</label>
                  <input
                    type="number"
                    value={formData.annual_gross_turnover_last_fy || ''}
                    onChange={(e) => handleChange('annual_gross_turnover_last_fy', e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: Financial & Loan Requirements */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-800 pt-6">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Loan Amount Required (₹) *</label>
              <input
                type="number"
                required
                min={1000}
                placeholder="e.g. 500000"
                value={formData.loan_amount_required || ''}
                onChange={(e) => handleChange('loan_amount_required', e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Loan Period (Months) *</label>
              <input
                type="number"
                required
                min={1}
                max={360}
                value={formData.loan_period_months || 12}
                onChange={(e) => handleChange('loan_period_months', e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 px-6 rounded-xl shadow-lg shadow-emerald-900/40 transition flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            {submitting ? (
              <span>Submitting Application...</span>
            ) : (
              <span>Submit Loan Application →</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
