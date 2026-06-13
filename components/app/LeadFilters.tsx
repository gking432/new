"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SERVICE_LABELS, SOURCE_LABELS, STAGE_STYLES } from "@/lib/utils/statuses";
import type { Profile } from "@/types/app";

const ALL = "__all__";

function FilterSelect({
  param,
  placeholder,
  options,
}: {
  param: string;
  placeholder: string;
  options: Array<[string, string]>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function apply(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === ALL) params.delete(param);
    else params.set(param, value);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <Select value={searchParams.get(param) ?? ALL} onValueChange={apply}>
      <SelectTrigger className="w-auto min-w-32 gap-2">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{placeholder}</SelectItem>
        {options.map(([value, label]) => (
          <SelectItem key={value} value={value}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function LeadFilters({ profiles }: { profiles: Profile[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hasFilters = [...searchParams.keys()].length > 0;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form
        className="relative"
        data-tour="leads-search"
        onSubmit={(event) => {
          event.preventDefault();
          const value = String(new FormData(event.currentTarget).get("search") ?? "");
          const params = new URLSearchParams(searchParams.toString());
          if (value) params.set("search", value);
          else params.delete("search");
          router.push(`${pathname}?${params.toString()}`);
        }}
      >
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          name="search"
          defaultValue={searchParams.get("search") ?? ""}
          placeholder="Search name, email, address…"
          className="w-64 pl-9"
        />
      </form>
      <FilterSelect
        param="service_type"
        placeholder="All services"
        options={Object.entries(SERVICE_LABELS)}
      />
      <FilterSelect
        param="urgency"
        placeholder="All urgency"
        options={[
          ["emergency", "Emergency"],
          ["high", "High"],
          ["medium", "Medium"],
          ["low", "Low"],
        ]}
      />
      <FilterSelect
        param="quality"
        placeholder="All quality"
        options={[
          ["hot", "Hot"],
          ["warm", "Warm"],
          ["cold", "Cold"],
        ]}
      />
      <FilterSelect
        param="stage"
        placeholder="All stages"
        options={Object.entries(STAGE_STYLES).map(([value, style]) => [value, style.label])}
      />
      <FilterSelect
        param="source"
        placeholder="All sources"
        options={Object.entries(SOURCE_LABELS)}
      />
      <FilterSelect
        param="assigned_to"
        placeholder="All reps"
        options={profiles.map((profile) => [profile.id, profile.full_name])}
      />
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={() => router.push(pathname)}>
          <X className="h-3.5 w-3.5" />
          Clear
        </Button>
      )}
    </div>
  );
}
