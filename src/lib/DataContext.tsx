import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Catalog, CompanySuggestions, SimilarityOverrides } from "./types";
import type { CompanySuggestionsV3, SiteHierarchy } from "./hierarchyTypes";
import { emptyOverrides, mergeOverrides } from "./similarity";
import {
  addCompanySuggestions,
  addCompanySuggestionsV3,
  clearCompanySuggestions,
  clearCompanySuggestionsV3,
  loadCompanySuggestions,
  loadCompanySuggestionsV3,
  loadOverridesFromStorage,
  saveCompanySuggestions,
  saveCompanySuggestionsV3,
  saveOverridesToStorage,
} from "./storage";

type AppData = {
  catalog: Catalog | null;
  hierarchy: SiteHierarchy | null;
  overrides: SimilarityOverrides;
  companies: CompanySuggestions[];
  companiesV3: CompanySuggestionsV3[];
  loading: boolean;
  error: string | null;
  setOverrides: (ov: SimilarityOverrides) => void;
  setCompanies: (list: CompanySuggestions[]) => void;
  setCompaniesV3: (list: CompanySuggestionsV3[]) => void;
  importCompanyFile: (file: CompanySuggestions) => void;
  importCompanyFileV3: (file: CompanySuggestionsV3) => void;
  clearCompanies: () => void;
  clearCompaniesV3: () => void;
  reloadCatalog: () => Promise<void>;
};

const Ctx = createContext<AppData | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [hierarchy, setHierarchy] = useState<SiteHierarchy | null>(null);
  const [overrides, setOverridesState] = useState<SimilarityOverrides>(emptyOverrides());
  const [companies, setCompaniesState] = useState<CompanySuggestions[]>([]);
  const [companiesV3, setCompaniesV3State] = useState<CompanySuggestionsV3[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reloadCatalog = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [catRes, ovRes, hierRes] = await Promise.all([
        fetch("/data/catalog.json"),
        fetch("/data/similarity-overrides.json"),
        fetch("/data/site-hierarchy.json"),
      ]);
      if (!catRes.ok) throw new Error("Could not load catalog.json — run npm run import-xlsx");
      const cat = (await catRes.json()) as Catalog;
      let ov = emptyOverrides();
      if (ovRes.ok) {
        ov = mergeOverrides(await ovRes.json());
      }
      const stored = loadOverridesFromStorage();
      if (stored) ov = mergeOverrides(stored);
      setCatalog(cat);
      setOverridesState(ov);
      setCompaniesState(loadCompanySuggestions());
      setCompaniesV3State(loadCompanySuggestionsV3());
      if (hierRes.ok) {
        setHierarchy((await hierRes.json()) as SiteHierarchy);
      } else {
        setHierarchy(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reloadCatalog();
  }, [reloadCatalog]);

  const setOverrides = (ov: SimilarityOverrides) => {
    const merged = mergeOverrides(ov);
    setOverridesState(merged);
    saveOverridesToStorage(merged);
  };

  const setCompanies = (list: CompanySuggestions[]) => {
    setCompaniesState(list);
    saveCompanySuggestions(list);
  };

  const setCompaniesV3 = (list: CompanySuggestionsV3[]) => {
    setCompaniesV3State(list);
    saveCompanySuggestionsV3(list);
  };

  const importCompanyFile = (file: CompanySuggestions) => {
    setCompaniesState(addCompanySuggestions(file));
  };

  const importCompanyFileV3 = (file: CompanySuggestionsV3) => {
    setCompaniesV3State(addCompanySuggestionsV3(file));
  };

  const clearCompanies = () => {
    clearCompanySuggestions();
    setCompaniesState([]);
  };

  const clearCompaniesV3 = () => {
    clearCompanySuggestionsV3();
    setCompaniesV3State([]);
  };

  const value = useMemo(
    () => ({
      catalog,
      hierarchy,
      overrides,
      companies,
      companiesV3,
      loading,
      error,
      setOverrides,
      setCompanies,
      setCompaniesV3,
      importCompanyFile,
      importCompanyFileV3,
      clearCompanies,
      clearCompaniesV3,
      reloadCatalog,
    }),
    [
      catalog,
      hierarchy,
      overrides,
      companies,
      companiesV3,
      loading,
      error,
      reloadCatalog,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppData() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAppData outside provider");
  return v;
}
