import i18next from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { env } from "process";
// @ts-ignore
import bootstrap from 'bootstrap/dist/js/bootstrap';
// @ts-ignore
import en from "../i18n/en.json";
// @ts-ignore
import zh_CN from "../i18n/zh_CN.json";

const lngs = {
    en: { nativeName: "English" },
    zh_CN: { nativeName: "简体中文" },
}
const rerender = () => {
    document.querySelectorAll("[data-i18n]").forEach((el) => {
        const key = el.getAttribute("data-i18n")!;
        el.getAttribute("data-i18n-attr") ? el.setAttribute(el.getAttribute("data-i18n-attr")!, i18next.t(key)) : 
            el.innerHTML = i18next.t(key);
    });
    document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(tooltipTiggerEl => new bootstrap.Tooltip(tooltipTiggerEl));

}

i18next.use(LanguageDetector).init({
    fallbackLng: "en",
    detection: {
        order: ["localStorage", "navigator"],
        caches: ["localStorage"]
    },
    debug: env.NODE_ENV !== "production",
    resources: {
        en: { translation: en },
        zh_CN: { translation: zh_CN }
    }
}, (err, t) => {
    if (err) {
        console.error(err);
    }
    const languageSwitcher = document.getElementById("languageSwitcher") as HTMLElement;
    Object.keys(lngs).map((lng: string) => {
        // @ts-ignore
        const opt = new Option(lngs[lng].nativeName, lng);
        if (lng === i18next.resolvedLanguage) {
          opt.setAttribute("selected", "selected");
        }
        languageSwitcher.appendChild(opt);
    });
    languageSwitcher.addEventListener("change", (e) => {
        // @ts-ignore
        const chosenLng = languageSwitcher.options[languageSwitcher.selectedIndex].value;
        i18next.changeLanguage(chosenLng, () => {
            rerender();
        });
    });

    rerender();
});

export default i18next

    