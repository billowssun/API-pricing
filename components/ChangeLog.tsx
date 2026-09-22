"use client";
import { useState } from "react";
import { IconFileSearch, IconHistory } from "@tabler/icons-react";
const filters = ["全部", "上新", "调价", "退役"];
export function ChangeLog() {
  const [filter, setFilter] = useState("全部");
  return (
    <div className="mini-window change-log">
      <div className="window-title">
        <span>
          <IconHistory size={14} /> 已核验变更
        </span>
        <span>CHANGELOG</span>
      </div>
      <div className="change-filters" role="group" aria-label="按变更类型筛选">
        {filters.map((label) => (
          <button
            type="button"
            key={label}
            aria-pressed={filter === label}
            onClick={() => setFilter(label)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="change-empty" aria-live="polite">
        <IconFileSearch size={32} stroke={1.3} />
        <strong>
          {filter === "全部" ? "暂无已核验变更" : `暂无已核验的${filter}记录`}
        </strong>
        <p>只记录有来源依据的变化，不推测发布日期。</p>
      </div>
    </div>
  );
}
