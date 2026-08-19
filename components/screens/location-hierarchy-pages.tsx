"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, Edit, Globe, MapPin, Plus, RefreshCw, Trash2 } from "lucide-react";

import { adminApi, type MakerCheckerActionResponse } from "@/apis/admin";
import { PageHeader } from "@/components/module";
import { Column, DataTable } from "@/components/ui/data-table";
import { Badge, Button, Card, CardContent, Field, Input, Label, Modal, Select } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import type { BranchItem, BranchSyncResult, DistrictItem, RegionItem, StateItem, SubRegionItem } from "@/types/auth";
import type { DistrictOption, RegionOption, StateOption } from "@/types/dsa";

function isMakerResponse(res: any): res is MakerCheckerActionResponse {
  return res && typeof res === "object" && res.status === "pending" && typeof res.reference === "string";
}

type TabType = "regions" | "sub-regions" | "states" | "districts" | "branches";

export function LocationHierarchyPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<TabType>("regions");
  const [regionOptions, setRegionOptions] = useState<RegionOption[]>([]);
  const [stateOptions, setStateOptions] = useState<StateOption[]>([]);

  const loadParentOptions = useCallback(async () => {
    try {
      const [rRes, sRes] = await Promise.all([
        adminApi.getAdminRegionsDropdown().catch(() => ({ data: [] })),
        adminApi.getAdminStatesDropdown().catch(() => ({ data: [] })),
      ]);
      setRegionOptions(rRes.data || []);
      setStateOptions(sRes.data || []);
    } catch (e) { console.error("Failed to load parent options", e); }
  }, []);

  useEffect(() => { loadParentOptions(); }, [loadParentOptions]);

  return (
    <div className="space-y-6">
      <PageHeader title="Location Hierarchy" description="Manage geographic structure: Regions, Sub-Regions, States, Districts, and CBS Branches." />
      <div className="flex border-b border-slate-200 gap-1 overflow-x-auto">
        {[
          { id: "regions", label: "Regions", icon: Globe },
          { id: "sub-regions", label: "Sub-Regions", icon: MapPin },
          { id: "states", label: "States", icon: MapPin },
          { id: "districts", label: "Districts", icon: MapPin },
          { id: "branches", label: "Branches", icon: Building2 },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as TabType)} className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition ${isActive ? "border-blue-600 text-blue-600 font-semibold" : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"}`} type="button">
              <Icon className="h-4 w-4" />{tab.label}
            </button>
          );
        })}
      </div>
      {activeTab === "regions" && <RegionsTab toast={toast} />}
      {activeTab === "sub-regions" && <SubRegionsTab toast={toast} regionOptions={regionOptions} />}
      {activeTab === "states" && <StatesTab toast={toast} />}
      {activeTab === "districts" && <DistrictsTab toast={toast} stateOptions={stateOptions} />}
      {activeTab === "branches" && <BranchesTab toast={toast} regionOptions={regionOptions} stateOptions={stateOptions} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. REGIONS TAB
// ─────────────────────────────────────────────────────────────────────────────
function RegionsTab({ toast }: { toast: any }) {
  const [items, setItems] = useState<RegionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<RegionItem | null>(null);
  const [form, setForm] = useState({ region_code: "", region_name: "" });
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async (s = "") => {
    setLoading(true);
    try {
      const res = await adminApi.getRegions({ page: 1, per_page: 50, search: s.trim() || undefined });
      setItems(res.data || []);
    } catch (e: any) { toast({ title: "Failed to load regions", description: e.message, variant: "warning" }); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { loadData(search); }, [search]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = editing
        ? await adminApi.updateRegion(editing.region_code, { region_name: form.region_name.trim() })
        : await adminApi.createRegion({ region_code: form.region_code.trim(), region_name: form.region_name.trim() });
      if (isMakerResponse(res)) {
        toast({ title: "Submitted for Approval", description: `Reference: ${res.reference}`, variant: "success" });
      } else {
        toast({ title: editing ? "Region Updated" : "Region Created", variant: "success" });
      }
      setModalOpen(false);
      loadData(search);
    } catch (e: any) { toast({ title: "Save Failed", description: e.message, variant: "warning" }); }
    finally { setSaving(false); }
  };

  const handleDelete = async (item: RegionItem) => {
    if (!confirm(`Delete region "${item.region_name}" (${item.region_code})?`)) return;
    try {
      const res = await adminApi.deleteRegion(item.region_code);
      if (isMakerResponse(res)) { toast({ title: "Delete Submitted", description: `Reference: ${res.reference}`, variant: "success" }); }
      else { toast({ title: "Region Deleted", variant: "success" }); }
      loadData(search);
    } catch (e: any) { toast({ title: "Delete Failed", description: e.message, variant: "warning" }); }
  };

  const tableData = useMemo(() => items.map((r) => ({ ...r, id: String(r.id) })), [items]);
  const columns: Column<Omit<RegionItem, "id"> & { id: string }>[] = [
    { key: "region_code", header: "Region Code", sortable: true, cell: (r) => <span className="font-mono font-semibold text-slate-900">{r.region_code}</span> },
    { key: "region_name", header: "Region Name", sortable: true, cell: (r) => <span className="font-medium text-slate-800">{r.region_name}</span> },
    { key: "created_at", header: "Created At", cell: (r) => <span className="text-xs text-slate-500">{r.created_at ? new Date(r.created_at).toLocaleDateString() : "—"}</span> },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2 justify-between items-center">
        <Input placeholder="Search by code or name…" className="max-w-md" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Button onClick={() => { setEditing(null); setForm({ region_code: "", region_name: "" }); setModalOpen(true); }} type="button">
          <Plus className="h-4 w-4" /> Add Region
        </Button>
      </div>
      <Card><CardContent>
        {loading ? <div className="py-12 text-center text-sm text-slate-500">Loading regions…</div> :
          <DataTable columns={columns} items={tableData} searchKeys={["region_code", "region_name"]} emptyTitle="No regions found"
            actions={(row) => (
              <div className="flex justify-end gap-1">
                <Button size="sm" variant="outline" type="button" onClick={() => { setEditing({...row, id: Number(row.id)}); setForm({ region_code: row.region_code, region_name: row.region_name }); setModalOpen(true); }}><Edit className="h-3.5 w-3.5" /></Button>
                <Button size="sm" variant="danger" type="button" onClick={() => handleDelete({...row, id: Number(row.id)})}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            )}
          />}
      </CardContent></Card>
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Region" : "Add Region"}>
        <form onSubmit={handleSave} className="space-y-4">
          <Field><Label>Region Code</Label><Input required disabled={Boolean(editing)} value={form.region_code} onChange={(e) => setForm((f) => ({ ...f, region_code: e.target.value }))} placeholder="e.g. R001" maxLength={20} /></Field>
          <Field><Label>Region Name</Label><Input required value={form.region_name} onChange={(e) => setForm((f) => ({ ...f, region_name: e.target.value }))} placeholder="e.g. Western Region" maxLength={255} /></Field>
          <div className="flex justify-end gap-2 pt-3 border-t"><Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>Cancel</Button><Button disabled={saving} type="submit">{saving ? "Saving…" : "Save Region"}</Button></div>
        </form>
      </Modal>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. SUB-REGIONS TAB
// ─────────────────────────────────────────────────────────────────────────────
function SubRegionsTab({ toast, regionOptions }: { toast: any; regionOptions: RegionOption[] }) {
  const [items, setItems] = useState<SubRegionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [regionFilter, setRegionFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SubRegionItem | null>(null);
  const [form, setForm] = useState({ sub_region_code: "", sub_region_name: "", region_code: "" });
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async (s = "", r = "") => {
    setLoading(true);
    try {
      const res = await adminApi.getSubRegions({ page: 1, per_page: 50, search: s.trim() || undefined, region_code: r || undefined });
      setItems(res.data || []);
    } catch (e: any) { toast({ title: "Failed to load sub-regions", description: e.message, variant: "warning" }); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { loadData(search, regionFilter); }, [search, regionFilter]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = editing
        ? await adminApi.updateSubRegion(editing.sub_region_code, { sub_region_name: form.sub_region_name.trim(), region_code: form.region_code })
        : await adminApi.createSubRegion({ sub_region_code: form.sub_region_code.trim(), sub_region_name: form.sub_region_name.trim(), region_code: form.region_code });
      if (isMakerResponse(res)) { toast({ title: "Submitted for Approval", description: `Reference: ${res.reference}`, variant: "success" }); }
      else { toast({ title: editing ? "Sub-Region Updated" : "Sub-Region Created", variant: "success" }); }
      setModalOpen(false);
      loadData(search, regionFilter);
    } catch (e: any) { toast({ title: "Save Failed", description: e.message, variant: "warning" }); }
    finally { setSaving(false); }
  };

  const handleDelete = async (item: SubRegionItem) => {
    if (!confirm(`Delete sub-region "${item.sub_region_name}" (${item.sub_region_code})?`)) return;
    try {
      const res = await adminApi.deleteSubRegion(item.sub_region_code);
      if (isMakerResponse(res)) { toast({ title: "Delete Submitted", description: `Reference: ${res.reference}`, variant: "success" }); }
      else { toast({ title: "Sub-Region Deleted", variant: "success" }); }
      loadData(search, regionFilter);
    } catch (e: any) { toast({ title: "Delete Failed", description: e.message, variant: "warning" }); }
  };

  const tableData = useMemo(() => items.map((sr) => ({ ...sr, id: String(sr.id) })), [items]);
  const columns: Column<Omit<SubRegionItem, "id"> & { id: string }>[] = [
    { key: "sub_region_code", header: "Sub-Region Code", sortable: true, cell: (sr) => <span className="font-mono font-semibold text-slate-900">{sr.sub_region_code}</span> },
    { key: "sub_region_name", header: "Sub-Region Name", sortable: true, cell: (sr) => <span className="font-medium text-slate-800">{sr.sub_region_name}</span> },
    { key: "region_code", header: "Parent Region", sortable: true, cell: (sr) => <Badge>{sr.region_code}</Badge> },
    { key: "created_at", header: "Created At", cell: (sr) => <span className="text-xs text-slate-500">{sr.created_at ? new Date(sr.created_at).toLocaleDateString() : "—"}</span> },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2 justify-between items-center">
        <div className="flex gap-2 flex-1 max-w-lg">
          <Input placeholder="Search sub-region…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)}> 
            <option value="">All Regions</option>
            {regionOptions.map((r) => <option key={r.region_code} value={r.region_code}>{r.region_name}</option>)}
          </Select>
        </div>
        <Button onClick={() => { setEditing(null); setForm({ sub_region_code: "", sub_region_name: "", region_code: regionOptions[0]?.region_code || "" }); setModalOpen(true); }} type="button">
          <Plus className="h-4 w-4" /> Add Sub-Region
        </Button>
      </div>
      <Card><CardContent>
        {loading ? <div className="py-12 text-center text-sm text-slate-500">Loading sub-regions…</div> :
          <DataTable columns={columns} items={tableData} searchKeys={["sub_region_code", "sub_region_name", "region_code"]} emptyTitle="No sub-regions found"
            actions={(row) => (
              <div className="flex justify-end gap-1">
                <Button size="sm" variant="outline" type="button" onClick={() => { setEditing({...row, id: Number(row.id)}); setForm({ sub_region_code: row.sub_region_code, sub_region_name: row.sub_region_name, region_code: row.region_code }); setModalOpen(true); }}><Edit className="h-3.5 w-3.5" /></Button>
                <Button size="sm" variant="danger" type="button" onClick={() => handleDelete({...row, id: Number(row.id)})}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            )}
          />}
      </CardContent></Card>
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Sub-Region" : "Add Sub-Region"}>
        <form onSubmit={handleSave} className="space-y-4">
          <Field><Label>Sub-Region Code</Label><Input required disabled={Boolean(editing)} value={form.sub_region_code} onChange={(e) => setForm((f) => ({ ...f, sub_region_code: e.target.value }))} placeholder="e.g. SR001" maxLength={20} /></Field>
          <Field><Label>Sub-Region Name</Label><Input required value={form.sub_region_name} onChange={(e) => setForm((f) => ({ ...f, sub_region_name: e.target.value }))} placeholder="e.g. Pune Urban" maxLength={255} /></Field>
          <Field><Label>Parent Region</Label><Select required value={form.region_code} onChange={(e) => setForm((f) => ({ ...f, region_code: e.target.value }))}>
            <option value="">Select Region</option>
            {regionOptions.map((r) => <option key={r.region_code} value={r.region_code}>{r.region_name} ({r.region_code})</option>)}
          </Select></Field>
          <div className="flex justify-end gap-2 pt-3 border-t"><Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>Cancel</Button><Button disabled={saving} type="submit">{saving ? "Saving…" : "Save Sub-Region"}</Button></div>
        </form>
      </Modal>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. STATES TAB
// ─────────────────────────────────────────────────────────────────────────────
function StatesTab({ toast }: { toast: any }) {
  const [items, setItems] = useState<StateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<StateItem | null>(null);
  const [form, setForm] = useState({ state_code: "", state_name: "" });
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async (s = "") => {
    setLoading(true);
    try {
      const res = await adminApi.getStates({ page: 1, per_page: 50, search: s.trim() || undefined });
      setItems(res.data || []);
    } catch (e: any) { toast({ title: "Failed to load states", description: e.message, variant: "warning" }); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { loadData(search); }, [search]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = editing
        ? await adminApi.updateState(editing.state_code, { state_name: form.state_name.trim() })
        : await adminApi.createState({ state_code: form.state_code.trim(), state_name: form.state_name.trim() });
      if (isMakerResponse(res)) { toast({ title: "Submitted for Approval", description: `Reference: ${res.reference}`, variant: "success" }); }
      else { toast({ title: editing ? "State Updated" : "State Created", variant: "success" }); }
      setModalOpen(false);
      loadData(search);
    } catch (e: any) { toast({ title: "Save Failed", description: e.message, variant: "warning" }); }
    finally { setSaving(false); }
  };

  const handleDelete = async (item: StateItem) => {
    if (!confirm(`Delete state "${item.state_name}" (${item.state_code})?`)) return;
    try {
      const res = await adminApi.deleteState(item.state_code);
      if (isMakerResponse(res)) { toast({ title: "Delete Submitted", description: `Reference: ${res.reference}`, variant: "success" }); }
      else { toast({ title: "State Deleted", variant: "success" }); }
      loadData(search);
    } catch (e: any) { toast({ title: "Delete Failed", description: e.message, variant: "warning" }); }
  };

  const tableData = useMemo(() => items.map((st) => ({ ...st, id: String(st.id) })), [items]);
  const columns: Column<Omit<StateItem, "id"> & { id: string }>[] = [
    { key: "state_code", header: "State Code", sortable: true, cell: (st) => <span className="font-mono font-semibold text-slate-900">{st.state_code}</span> },
    { key: "state_name", header: "State Name", sortable: true, cell: (st) => <span className="font-medium text-slate-800">{st.state_name}</span> },
    { key: "created_at", header: "Created At", cell: (st) => <span className="text-xs text-slate-500">{st.created_at ? new Date(st.created_at).toLocaleDateString() : "—"}</span> },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2 justify-between items-center">
        <Input placeholder="Search state…" className="max-w-md" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Button onClick={() => { setEditing(null); setForm({ state_code: "", state_name: "" }); setModalOpen(true); }} type="button">
          <Plus className="h-4 w-4" /> Add State
        </Button>
      </div>
      <Card><CardContent>
        {loading ? <div className="py-12 text-center text-sm text-slate-500">Loading states…</div> :
          <DataTable columns={columns} items={tableData} searchKeys={["state_code", "state_name"]} emptyTitle="No states found"
            actions={(row) => (
              <div className="flex justify-end gap-1">
                <Button size="sm" variant="outline" type="button" onClick={() => { setEditing({...row, id: Number(row.id)}); setForm({ state_code: row.state_code, state_name: row.state_name }); setModalOpen(true); }}><Edit className="h-3.5 w-3.5" /></Button>
                <Button size="sm" variant="danger" type="button" onClick={() => handleDelete({...row, id: Number(row.id)})}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            )}
          />}
      </CardContent></Card>
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit State" : "Add State"}>
        <form onSubmit={handleSave} className="space-y-4">
          <Field><Label>State Code</Label><Input required disabled={Boolean(editing)} value={form.state_code} onChange={(e) => setForm((f) => ({ ...f, state_code: e.target.value }))} placeholder="e.g. MH" maxLength={20} /></Field>
          <Field><Label>State Name</Label><Input required value={form.state_name} onChange={(e) => setForm((f) => ({ ...f, state_name: e.target.value }))} placeholder="e.g. Maharashtra" maxLength={255} /></Field>
          <div className="flex justify-end gap-2 pt-3 border-t"><Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>Cancel</Button><Button disabled={saving} type="submit">{saving ? "Saving…" : "Save State"}</Button></div>
        </form>
      </Modal>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. DISTRICTS TAB
// ─────────────────────────────────────────────────────────────────────────────
function DistrictsTab({ toast, stateOptions }: { toast: any; stateOptions: StateOption[] }) {
  const [items, setItems] = useState<DistrictItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DistrictItem | null>(null);
  const [form, setForm] = useState({ district_code: "", district_name: "", state_code: "" });
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async (s = "", st = "") => {
    setLoading(true);
    try {
      const res = await adminApi.getDistricts({ page: 1, per_page: 50, search: s.trim() || undefined, state_code: st || undefined });
      setItems(res.data || []);
    } catch (e: any) { toast({ title: "Failed to load districts", description: e.message, variant: "warning" }); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { loadData(search, stateFilter); }, [search, stateFilter]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = editing
        ? await adminApi.updateDistrict(editing.district_code, { district_name: form.district_name.trim(), state_code: form.state_code })
        : await adminApi.createDistrict({ district_code: form.district_code.trim(), district_name: form.district_name.trim(), state_code: form.state_code });
      if (isMakerResponse(res)) { toast({ title: "Submitted for Approval", description: `Reference: ${res.reference}`, variant: "success" }); }
      else { toast({ title: editing ? "District Updated" : "District Created", variant: "success" }); }
      setModalOpen(false);
      loadData(search, stateFilter);
    } catch (e: any) { toast({ title: "Save Failed", description: e.message, variant: "warning" }); }
    finally { setSaving(false); }
  };

  const handleDelete = async (item: DistrictItem) => {
    if (!confirm(`Delete district "${item.district_name}" (${item.district_code})?`)) return;
    try {
      const res = await adminApi.deleteDistrict(item.district_code);
      if (isMakerResponse(res)) { toast({ title: "Delete Submitted", description: `Reference: ${res.reference}`, variant: "success" }); }
      else { toast({ title: "District Deleted", variant: "success" }); }
      loadData(search, stateFilter);
    } catch (e: any) { toast({ title: "Delete Failed", description: e.message, variant: "warning" }); }
  };

  const tableData = useMemo(() => items.map((d) => ({ ...d, id: String(d.id) })), [items]);
  const columns: Column<Omit<DistrictItem, "id"> & { id: string }>[] = [
    { key: "district_code", header: "District Code", sortable: true, cell: (d) => <span className="font-mono font-semibold text-slate-900">{d.district_code}</span> },
    { key: "district_name", header: "District Name", sortable: true, cell: (d) => <span className="font-medium text-slate-800">{d.district_name}</span> },
    { key: "state_code", header: "Parent State", sortable: true, cell: (d) => <Badge>{d.state_code}</Badge> },
    { key: "created_at", header: "Created At", cell: (d) => <span className="text-xs text-slate-500">{d.created_at ? new Date(d.created_at).toLocaleDateString() : "—"}</span> },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2 justify-between items-center">
        <div className="flex gap-2 flex-1 max-w-lg">
          <Input placeholder="Search district…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}> 
            <option value="">All States</option>
            {stateOptions.map((st) => <option key={st.state_code} value={st.state_code}>{st.state_name}</option>)}
          </Select>
        </div>
        <Button onClick={() => { setEditing(null); setForm({ district_code: "", district_name: "", state_code: stateOptions[0]?.state_code || "" }); setModalOpen(true); }} type="button">
          <Plus className="h-4 w-4" /> Add District
        </Button>
      </div>
      <Card><CardContent>
        {loading ? <div className="py-12 text-center text-sm text-slate-500">Loading districts…</div> :
          <DataTable columns={columns} items={tableData} searchKeys={["district_code", "district_name", "state_code"]} emptyTitle="No districts found"
            actions={(row) => (
              <div className="flex justify-end gap-1">
                <Button size="sm" variant="outline" type="button" onClick={() => { setEditing({...row, id: Number(row.id)}); setForm({ district_code: row.district_code, district_name: row.district_name, state_code: row.state_code }); setModalOpen(true); }}><Edit className="h-3.5 w-3.5" /></Button>
                <Button size="sm" variant="danger" type="button" onClick={() => handleDelete({...row, id: Number(row.id)})}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            )}
          />}
      </CardContent></Card>
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit District" : "Add District"}>
        <form onSubmit={handleSave} className="space-y-4">
          <Field><Label>District Code</Label><Input required disabled={Boolean(editing)} value={form.district_code} onChange={(e) => setForm((f) => ({ ...f, district_code: e.target.value }))} placeholder="e.g. DIST01" maxLength={20} /></Field>
          <Field><Label>District Name</Label><Input required value={form.district_name} onChange={(e) => setForm((f) => ({ ...f, district_name: e.target.value }))} placeholder="e.g. Pune" maxLength={255} /></Field>
          <Field><Label>Parent State</Label><Select required value={form.state_code} onChange={(e) => setForm((f) => ({ ...f, state_code: e.target.value }))}>
            <option value="">Select State</option>
            {stateOptions.map((st) => <option key={st.state_code} value={st.state_code}>{st.state_name} ({st.state_code})</option>)}
          </Select></Field>
          <div className="flex justify-end gap-2 pt-3 border-t"><Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>Cancel</Button><Button disabled={saving} type="submit">{saving ? "Saving…" : "Save District"}</Button></div>
        </form>
      </Modal>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. BRANCHES TAB (WITH CBS SYNC & DISTRICT ASSIGNMENT)
// ─────────────────────────────────────────────────────────────────────────────
function BranchesTab({ toast, regionOptions, stateOptions }: { toast: any; regionOptions: RegionOption[]; stateOptions: StateOption[] }) {
  const [items, setItems] = useState<BranchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [regionFilter, setRegionFilter] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [syncResult, setSyncResult] = useState<BranchSyncResult | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<BranchItem | null>(null);
  const [form, setForm] = useState({ branch_code: "", branch_name: "", branch_number: "", region_code: "", sub_region_code: "", district_code: "" });
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async (s = "", r = "") => {
    setLoading(true);
    try {
      const res = await adminApi.getBranches({ page: 1, per_page: 100, search: s.trim() || undefined, region_code: r || undefined });
      setItems(res.data || []);
    } catch (e: any) { toast({ title: "Failed to load branches", description: e.message, variant: "warning" }); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { loadData(search, regionFilter); }, [search, regionFilter]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await adminApi.syncBranches();
      setSyncResult(res.data);
      setSyncModalOpen(true);
      toast({ title: "CBS Branch Sync Complete", variant: "success" });
      loadData(search, regionFilter);
    } catch (e: any) { toast({ title: "Sync Failed", description: e.message, variant: "warning" }); }
    finally { setSyncing(false); }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = editing
        ? await adminApi.updateBranch(editing.branch_code, { district_code: form.district_code })
        : await adminApi.createBranch({
            branch_code: form.branch_code.trim(),
            branch_name: form.branch_name.trim(),
            branch_number: form.branch_number.trim() || undefined,
            region_code: form.region_code,
            sub_region_code: form.sub_region_code,
            district_code: form.district_code || undefined,
          });
      if (isMakerResponse(res)) { toast({ title: "Submitted for Approval", description: `Reference: ${res.reference}`, variant: "success" }); }
      else { toast({ title: editing ? "Branch Updated" : "Branch Created", variant: "success" }); }
      setModalOpen(false);
      loadData(search, regionFilter);
    } catch (e: any) { toast({ title: "Save Failed", description: e.message, variant: "warning" }); }
    finally { setSaving(false); }
  };

  const handleDelete = async (item: BranchItem) => {
    if (!confirm(`Delete branch "${item.branch_name}" (${item.branch_code})?`)) return;
    try {
      const res = await adminApi.deleteBranch(item.branch_code);
      if (isMakerResponse(res)) { toast({ title: "Delete Submitted", description: `Reference: ${res.reference}`, variant: "success" }); }
      else { toast({ title: "Branch Deleted", variant: "success" }); }
      loadData(search, regionFilter);
    } catch (e: any) { toast({ title: "Delete Failed", description: e.message, variant: "warning" }); }
  };

  const tableData = useMemo(() => items.map((b) => ({ ...b, id: String(b.id) })), [items]);
  const columns: Column<Omit<BranchItem, "id"> & { id: string }>[] = [
    { key: "branch_code", header: "Branch Code", sortable: true, cell: (b) => <span className="font-mono font-semibold text-slate-900">{b.branch_code}</span> },
    { key: "branch_name", header: "Branch Name", sortable: true, cell: (b) => <span className="font-medium text-slate-800">{b.branch_name}</span> },
    { key: "region_code", header: "Region", sortable: true, cell: (b) => <Badge>{b.region_code}</Badge> },
    { key: "sub_region_code", header: "Sub-Region", sortable: true, cell: (b) => <span className="text-xs text-slate-600 font-mono">{b.sub_region_code}</span> },
    { key: "district_code", header: "District", sortable: true, cell: (b) => b.district_code ? <span className="font-mono text-xs font-semibold text-blue-700">{b.district_code}</span> : <span className="text-xs text-amber-600 font-medium">Unassigned</span> },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2 justify-between items-center">
        <div className="flex gap-2 flex-1 max-w-lg">
          <Input placeholder="Search branch code or name…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)}> 
            <option value="">All Regions</option>
            {regionOptions.map((r) => <option key={r.region_code} value={r.region_code}>{r.region_name}</option>)}
          </Select>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSync} disabled={syncing} variant="outline" type="button">
            <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing CBS…" : "Sync CBS Branches"}
          </Button>
          <Button onClick={() => { setEditing(null); setForm({ branch_code: "", branch_name: "", branch_number: "", region_code: regionOptions[0]?.region_code || "", sub_region_code: "", district_code: "" }); setModalOpen(true); }} type="button">
            <Plus className="h-4 w-4" /> Add Branch
          </Button>
        </div>
      </div>
      <Card><CardContent>
        {loading ? <div className="py-12 text-center text-sm text-slate-500">Loading branches…</div> :
          <DataTable columns={columns} items={tableData} searchKeys={["branch_code", "branch_name", "region_code", "sub_region_code", "district_code"]} emptyTitle="No branches found"
            actions={(row) => (
              <div className="flex justify-end gap-1">
                <Button size="sm" variant="outline" type="button" onClick={() => { setEditing({...row, id: Number(row.id)}); setForm({ branch_code: row.branch_code, branch_name: row.branch_name, branch_number: row.branch_number || "", region_code: row.region_code, sub_region_code: row.sub_region_code, district_code: row.district_code || "" }); setModalOpen(true); }}><Edit className="h-3.5 w-3.5" /></Button>
                <Button size="sm" variant="danger" type="button" onClick={() => handleDelete({...row, id: Number(row.id)})}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            )}
          />}
      </CardContent></Card>
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? `Edit Branch (${editing.branch_code})` : "Add Branch"}>
        <form onSubmit={handleSave} className="space-y-4">
          {editing ? (
            <>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-1 text-xs text-slate-700">
                <p><strong>Branch Code:</strong> {editing.branch_code}</p>
                <p><strong>Branch Name:</strong> {editing.branch_name}</p>
                <p><strong>Region:</strong> {editing.region_code} | <strong>Sub-Region:</strong> {editing.sub_region_code}</p>
                <p className="text-slate-500 italic mt-1">* Note: CBS controls Branch Name, Region, and Sub-Region via automated sync. Only District Code is managed locally.</p>
              </div>
              <Field><Label>District Code</Label><Input required value={form.district_code} onChange={(e) => setForm((f) => ({ ...f, district_code: e.target.value }))} placeholder="e.g. DIST01" maxLength={20} /></Field>
            </>
          ) : (
            <>
              <Field><Label>Branch Code</Label><Input required value={form.branch_code} onChange={(e) => setForm((f) => ({ ...f, branch_code: e.target.value }))} placeholder="e.g. 001" maxLength={20} /></Field>
              <Field><Label>Branch Name</Label><Input required value={form.branch_name} onChange={(e) => setForm((f) => ({ ...f, branch_name: e.target.value }))} placeholder="e.g. PARVATI BRANCH" maxLength={255} /></Field>
              <Field><Label>Branch Number (Optional)</Label><Input value={form.branch_number} onChange={(e) => setForm((f) => ({ ...f, branch_number: e.target.value }))} placeholder="e.g. BR-101" maxLength={50} /></Field>
              <Field><Label>Region Code</Label><Input required value={form.region_code} onChange={(e) => setForm((f) => ({ ...f, region_code: e.target.value }))} placeholder="e.g. PRO" maxLength={20} /></Field>
              <Field><Label>Sub-Region Code</Label><Input required value={form.sub_region_code} onChange={(e) => setForm((f) => ({ ...f, sub_region_code: e.target.value }))} placeholder="e.g. PRO-RO1" maxLength={20} /></Field>
              <Field><Label>District Code (Optional)</Label><Input value={form.district_code} onChange={(e) => setForm((f) => ({ ...f, district_code: e.target.value }))} placeholder="e.g. DIST01" maxLength={20} /></Field>
            </>
          )}
          <div className="flex justify-end gap-2 pt-3 border-t"><Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>Cancel</Button><Button disabled={saving} type="submit">{saving ? "Saving…" : "Save Branch"}</Button></div>
        </form>
      </Modal>
      <Modal open={syncModalOpen} onClose={() => setSyncModalOpen(false)} title="CBS Branch Sync Summary">
        {syncResult && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-md bg-emerald-50 border border-emerald-100 p-3"><p className="text-2xl font-bold text-emerald-700">{syncResult.inserted}</p><p className="text-emerald-600 font-medium">Inserted</p></div>
              <div className="rounded-md bg-blue-50 border border-blue-100 p-3"><p className="text-2xl font-bold text-blue-700">{syncResult.updated}</p><p className="text-blue-600 font-medium">Updated</p></div>
              <div className="rounded-md bg-slate-50 border border-slate-200 p-3"><p className="text-2xl font-bold text-slate-700">{syncResult.unchanged}</p><p className="text-slate-600 font-medium">Unchanged</p></div>
            </div>
            {syncResult.skipped && syncResult.skipped.length > 0 && (
              <div className="rounded border border-amber-200 bg-amber-50 p-3"><p className="text-xs font-semibold text-amber-700 mb-1">Skipped Entries:</p><ul className="text-xs text-amber-600 space-y-0.5 list-disc pl-4">{syncResult.skipped.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
            )}
            <div className="flex justify-end pt-3 border-t"><Button onClick={() => setSyncModalOpen(false)} type="button">Close</Button></div>
          </div>
        )}
      </Modal>
    </div>
  );
}
