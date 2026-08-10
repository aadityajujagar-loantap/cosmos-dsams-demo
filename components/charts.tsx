"use client";

import { ArrowDownRight, ArrowUpRight, LucideIcon } from "lucide-react";
import { ReactNode, useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Funnel,
  FunnelChart,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, Skeleton } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

const colors = ["#2563eb", "#38bdf8", "#4c1d95", "#0f172a", "#7c3aed", "#0284c7"];

function ChartFrame({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setReady(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  if (!ready) {
    return <Skeleton className="h-full w-full" />;
  }

  return <>{children}</>;
}

export function KpiCard({
  icon: Icon,
  label,
  value,
  change,
  tone = "blue",
}: {
  change: string;
  icon: LucideIcon;
  label: string;
  tone?: "blue" | "green" | "amber" | "slate";
  value: string;
}) {
  const positive = !change.startsWith("-");
  return (
    <Card>
      <CardContent className="p-3.5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{value}</p>
          </div>
          <div
            className={cn(
              "grid h-10 w-10 place-items-center rounded-md",
              tone === "blue" && "bg-blue-50 text-blue-700",
              tone === "green" && "bg-emerald-50 text-emerald-700",
              tone === "amber" && "bg-sky-50 text-blue-800",
              tone === "slate" && "bg-slate-100 text-slate-700",
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <p className={cn("mt-3 inline-flex items-center gap-1 text-xs font-medium", positive ? "text-emerald-700" : "text-rose-700")}>
          {positive ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
          {change} vs last month
        </p>
      </CardContent>
    </Card>
  );
}

export function TrendCard({
  data,
  dataKey,
  title,
  subtitle,
  type = "line",
}: {
  data: Record<string, string | number>[];
  dataKey: string;
  subtitle: string;
  title: string;
  type?: "line" | "area";
}) {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-base font-semibold text-slate-950">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      </CardHeader>
      <CardContent className="h-64">
        <ChartFrame>
          <ResponsiveContainer height="100%" minWidth={0} width="100%" initialDimension={{ width: 100, height: 100 }}>
            {type === "area" ? (
              <AreaChart data={data}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" tickLine={false} />
                <YAxis stroke="#64748b" tickLine={false} width={36} />
                <Tooltip />
                <Area dataKey={dataKey} fill="#dbeafe" stroke="#2563eb" strokeWidth={2} type="monotone" />
              </AreaChart>
            ) : (
              <LineChart data={data}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" tickLine={false} />
                <YAxis stroke="#64748b" tickLine={false} width={36} />
                <Tooltip />
                <Line dataKey={dataKey} dot={{ r: 3 }} stroke="#2563eb" strokeWidth={2.5} type="monotone" />
              </LineChart>
            )}
          </ResponsiveContainer>
        </ChartFrame>
      </CardContent>
    </Card>
  );
}

export function BarChartCard({
  data,
  dataKey,
  title,
  subtitle,
}: {
  data: Record<string, string | number>[];
  dataKey: string;
  subtitle: string;
  title: string;
}) {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-base font-semibold text-slate-950">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      </CardHeader>
      <CardContent className="h-64">
        <ChartFrame>
          <ResponsiveContainer height="100%" minWidth={0} width="100%" initialDimension={{ width: 100, height: 100 }}>
            <BarChart data={data}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" stroke="#64748b" tickLine={false} />
              <YAxis stroke="#64748b" tickLine={false} width={36} />
              <Tooltip />
              <Bar dataKey={dataKey} fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartFrame>
      </CardContent>
    </Card>
  );
}

export function PieChartCard({
  data,
  dataKey,
  title,
  subtitle,
}: {
  data: Record<string, string | number>[];
  dataKey: string;
  subtitle: string;
  title: string;
}) {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-base font-semibold text-slate-950">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      </CardHeader>
      <CardContent className="h-64 flex flex-col justify-between">
        <div className="h-44">
          <ChartFrame>
            <ResponsiveContainer height="100%" minWidth={0} width="100%" initialDimension={{ width: 100, height: 100 }}>
              <PieChart>
                <Pie data={data} dataKey={dataKey} innerRadius={42} outerRadius={72} paddingAngle={3}>
                  {data.map((_, index) => (
                    <Cell fill={colors[index % colors.length]} key={index} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </ChartFrame>
        </div>
        <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 border-t border-slate-100 pt-3">
          {data.map((item, index) => (
            <span className="inline-flex items-center gap-1.5 min-w-0" key={String(item.name)}>
              <span className="h-2 w-2 rounded-full shrink-0 block" style={{ backgroundColor: colors[index % colors.length] }} />
              <span className="truncate leading-none">{String(item.name)}</span>
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function FunnelCard({
  data,
  title,
  subtitle,
}: {
  data: Record<string, string | number>[];
  subtitle: string;
  title: string;
}) {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-base font-semibold text-slate-950">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      </CardHeader>
      <CardContent className="h-64">
        <ChartFrame>
          <ResponsiveContainer height="100%" minWidth={0} width="100%" initialDimension={{ width: 100, height: 100 }}>
            <FunnelChart>
              <Tooltip />
              <Funnel data={data} dataKey="value" isAnimationActive nameKey="name">
                {data.map((_, index) => (
                  <Cell fill={colors[index % colors.length]} key={index} />
                ))}
              </Funnel>
            </FunnelChart>
          </ResponsiveContainer>
        </ChartFrame>
      </CardContent>
    </Card>
  );
}
