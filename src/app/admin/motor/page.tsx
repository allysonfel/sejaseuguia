import Topbar from "@/components/admin/Topbar";
import EngineAdmin from "@/components/admin/EngineAdmin";
import { requireStaff } from "@/lib/auth";
import { getRules } from "@/lib/data";
import { getSetting } from "@/lib/db";
import { DEFAULT_RULES, type Rules } from "@/lib/types";

export default async function Motor() {
  await requireStaff("engine");
  const published = await getRules();
  const draft = await getSetting<Rules>("rules_draft", DEFAULT_RULES);
  return (
    <>
      <Topbar title="Motor de roteiros" />
      <div className="content">
        <EngineAdmin draft={{ ...DEFAULT_RULES, ...draft }} version={published.version} publishedAt={published.publishedAt} />
      </div>
    </>
  );
}
