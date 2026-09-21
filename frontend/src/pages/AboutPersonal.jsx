import React from "react";
import { Dumbbell, Mail } from "lucide-react";

export default function AboutPersonal({ profile = {}, branding }) {
  const name = branding?.display_name || profile.name || "Personal";
  const image = branding?.logo_url || branding?.profile_image_url || branding?.icon_url || "/fitland-icon.svg";

  return (
    <section className="about-personal-page">
      <article className="about-personal-hero">
        <div>
          <p className="eyebrow">Sobre o Personal</p>
          <h2>{name}</h2>
          <p>Informações profissionais ainda não cadastradas.</p>
        </div>
        <img src={image} alt={name} />
      </article>
      <section className="about-personal-content">
        <article className="about-card-large">
          <p className="eyebrow">Perfil profissional</p>
          <h3>Informações ainda não cadastradas.</h3>
        </article>
      </section>
      <section className="about-contact-card">
        <div><Dumbbell size={22} /><span>{name}</span></div>
        {profile.email ? <div><Mail size={20} /><span>{profile.email}</span></div> : null}
      </section>
    </section>
  );
}
