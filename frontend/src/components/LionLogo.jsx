import React, { useEffect, useState } from "react";

export default function LionLogo({ compact = false, hero = false, branding = null, platform = false }) {
  const data = platform
    ? { display_name: "Fitland", login_subtitle: "Performance, gestão e evolução", initials: "FT" }
    : branding;
  const displayName = data?.display_name || "Fitland";
  const logoUrl = compact ? data?.icon_url || data?.logo_url : data?.logo_url || data?.icon_url;
  const [imageFailed, setImageFailed] = useState(false);
  const isPersonalBrand = !platform && displayName.toLowerCase().startsWith("personal ");
  const brandName = isPersonalBrand ? displayName.slice("Personal ".length) : displayName;
  const hasWordmarkAsset = !compact && Boolean(data?.logo_url);

  useEffect(() => setImageFailed(false), [logoUrl]);

  return (
    <div className={`lion-logo ${compact ? "compact" : ""} ${hero ? "hero" : ""} ${hasWordmarkAsset ? "has-wordmark-asset" : ""}`} aria-label={displayName}>
      <div className="lion-mark">
        {logoUrl && !imageFailed
          ? <img src={logoUrl} alt={`Logo ${displayName}`} onError={() => setImageFailed(true)} />
          : <span className="fitland-mark">{data?.initials || "FT"}</span>}
      </div>
      {!compact && !hasWordmarkAsset && (
        <div className="brand-lockup">
          <span>{platform ? "Plataforma" : "Personal"}</span>
          <strong>{brandName}</strong>
          <small>{data?.login_subtitle || "Performance • Gestão • Evolução"}</small>
        </div>
      )}
    </div>
  );
}
