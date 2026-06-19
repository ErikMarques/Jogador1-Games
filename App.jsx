import React, { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  BarChart3,
  Bell,
  CheckCircle,
  Boxes,
  CalendarDays,
  DollarSign,
  Download,
  Gamepad2,
  ImagePlus,
  LayoutDashboard,
  LogOut,
  Package,
  Pencil,
  Plus,
  ReceiptText,
  ShoppingCart,
  Trash2,
  TrendingUp,
  Users,
  Wallet,
  Wrench,
  X,
} from "lucide-react";

const APP_VERSION = "5.1.4";
const STORAGE_BUCKET = "produto-imagens";
const MASCOT_BUCKET = "mascotes";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const NATIVE_MASCOTS = [
  { id: "native-runner", nome: "Pixel Runner", tipo: "saltador", native: "runner", tamanho: "medio", frequencia: "normal", status: "A", origem: "Nativo" },
  { id: "native-orb", nome: "Orb Elétrica", tipo: "eletrico", native: "orb", tamanho: "pequeno", frequencia: "normal", status: "A", origem: "Nativo" },
  { id: "native-dragon", nome: "Drako", tipo: "dragao", native: "dragon", tamanho: "grande", frequencia: "normal", status: "A", origem: "Nativo" },
  { id: "native-cart", nome: "Cartucho Retrô", tipo: "quicante", native: "cart", tamanho: "pequeno", frequencia: "normal", status: "A", origem: "Nativo" },
  { id: "native-coin", nome: "Moeda Gamer", tipo: "quicante", native: "coin", tamanho: "pequeno", frequencia: "baixa", status: "A", origem: "Nativo" },
  { id: "native-star", nome: "Estrela Pixel", tipo: "voador", native: "star", tamanho: "pequeno", frequencia: "baixa", status: "A", origem: "Nativo" },
];

const emptyMascotForm = {
  nome: "",
  tipo: "saltador",
  tamanho: "medio",
  frequencia: "normal",
  status: "A",
  file: null,
  preview: "",
  native: "",
  removerFundo: true,
  toleranciaFundo: "media",
};

function getStoredNativeMascots() {
  try {
    const saved = JSON.parse(localStorage.getItem("j1_native_mascots") || "{}");
    return NATIVE_MASCOTS.map((m) => ({ ...m, ...(saved[m.id] || {}) }));
  } catch {
    return NATIVE_MASCOTS;
  }
}

function saveStoredNativeMascots(mascots) {
  try {
    const compact = {};
    mascots.forEach((m) => {
      compact[m.id] = {
        nome: m.nome,
        tipo: m.tipo,
        tamanho: m.tamanho,
        frequencia: m.frequencia,
        status: m.status,
        native: m.native,
        origem: "Nativo",
      };
    });
    localStorage.setItem("j1_native_mascots", JSON.stringify(compact));
  } catch {}
}

function backgroundTolerance(level) {
  if (level === "baixa") return 18;
  if (level === "alta") return 70;
  return 42;
}

function isLightBackgroundPixel(data, index, tolerance) {
  const r = data[index];
  const g = data[index + 1];
  const b = data[index + 2];
  const a = data[index + 3];

  if (a < 20) return false;

  const brightness = (r + g + b) / 3;
  const spread = Math.max(r, g, b) - Math.min(r, g, b);

  return brightness >= 255 - tolerance && spread <= tolerance * 1.35;
}

async function removeWhiteBackgroundFromMascot(file, toleranceLevel = "media") {
  if (!file || !file.type?.startsWith("image/")) return file;

  const tolerance = backgroundTolerance(toleranceLevel);
  const imageUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = imageUrl;
    });

    const canvas = document.createElement("canvas");
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(image, 0, 0, width, height);

    const imageData = ctx.getImageData(0, 0, width, height);
    const { data } = imageData;
    const visited = new Uint8Array(width * height);
    const queue = [];

    function enqueue(x, y) {
      if (x < 0 || y < 0 || x >= width || y >= height) return;
      const p = y * width + x;
      if (visited[p]) return;

      const i = p * 4;
      if (!isLightBackgroundPixel(data, i, tolerance)) return;

      visited[p] = 1;
      queue.push(p);
    }

    for (let x = 0; x < width; x++) {
      enqueue(x, 0);
      enqueue(x, height - 1);
    }

    for (let y = 0; y < height; y++) {
      enqueue(0, y);
      enqueue(width - 1, y);
    }

    let cursor = 0;

    while (cursor < queue.length) {
      const p = queue[cursor++];
      const x = p % width;
      const y = Math.floor(p / width);

      enqueue(x + 1, y);
      enqueue(x - 1, y);
      enqueue(x, y + 1);
      enqueue(x, y - 1);
    }

    for (let p = 0; p < visited.length; p++) {
      if (!visited[p]) continue;
      const i = p * 4;
      data[i + 3] = 0;
    }

    ctx.putImageData(imageData, 0, 0);

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) return file;

    const cleanName = file.name.replace(/\.(png|webp|jpg|jpeg)$/i, "");
    return new File([blob], `${cleanName}-sem-fundo.png`, { type: "image/png" });
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}


const emptyProduct = {
  nome: "",
  sku: "",
  compra: "",
  vendaEsperada: "",
  vendaReal: "",
  estoqueMinimo: 1,
  quantidade: 1,
  imagens: [],
  custosExtras: [],
};

const permissionsByRole = {
  administrador: { canCreate: true, canEdit: true, canDelete: true, canSell: true, canFinancial: true, canUsers: true, canBackup: true },
  funcionario: { canCreate: true, canEdit: true, canDelete: false, canSell: true, canFinancial: false, canUsers: false, canBackup: true },
  visualizacao: { canCreate: false, canEdit: false, canDelete: false, canSell: false, canFinancial: false, canUsers: false, canBackup: false },
};

function currency(value) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function dateKey(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function formatDateBR(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("pt-BR");
}

function monthKeyFromValue(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function currentMonthKey() {
  return monthKeyFromValue(new Date());
}

function monthLabelFromKey(key) {
  if (!key) return "";
  const [year, month] = key.split("-").map(Number);
  const d = new Date(year, month - 1, 1);
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function productMovementDate(product) {
  if (!product) return new Date().toISOString();

  if (product.status === "Vendido") {
    return product.dataVenda || product.dataCompra || new Date().toISOString();
  }

  return product.dataCompra || new Date().toISOString();
}

function productSaleDate(product) {
  return product?.dataVenda || product?.dataCompra || new Date().toISOString();
}


function currentMonthLabel() {
  const label = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function costExtrasTotal(p) {
  if (Array.isArray(p.custosExtras) && p.custosExtras.length) {
    return p.custosExtras.reduce((acc, item) => acc + Number(item.valor || 0), 0);
  }

  return Number(p.chip || 0) + Number(p.frete || 0) + Number(p.manutencao || 0) + Number(p.outros || 0);
}

function productMath(p) {
  const custoFinal = Number(p.compra || 0) + costExtrasTotal(p);
  const lucroEsperado = Number(p.vendaEsperada || 0) - custoFinal;
  const lucroReal = p.status === "Vendido" ? Number(p.vendaReal || 0) - custoFinal : 0;
  return { custoFinal, lucroEsperado, lucroReal, custosExtras: costExtrasTotal(p) };
}

function placeholderImage(text, color = "#dc2626") {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="220" viewBox="0 0 300 220"><rect width="300" height="220" rx="24" fill="#101014"/><rect x="18" y="18" width="264" height="184" rx="20" fill="${color}" opacity="0.18"/><circle cx="150" cy="82" r="42" fill="${color}" opacity="0.8"/><rect x="86" y="132" width="128" height="18" rx="9" fill="#ffffff" opacity="0.9"/><rect x="108" y="160" width="84" height="10" rx="5" fill="#ffffff" opacity="0.55"/><text x="150" y="207" font-family="Arial" font-size="16" font-weight="700" text-anchor="middle" fill="#ffffff">${text}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function imageSrc(image) {
  if (!image) return "";
  if (typeof image === "string") return image;
  return image.preview || image.url || "";
}

function isStorageUrl(url) {
  return typeof url === "string" && url.includes(`/storage/v1/object/public/${STORAGE_BUCKET}/`);
}

function storagePathFromPublicUrl(url) {
  if (!isStorageUrl(url)) return null;
  const marker = `/storage/v1/object/public/${STORAGE_BUCKET}/`;
  return decodeURIComponent(url.split(marker)[1] || "");
}

export default function App() {
  const [activeMenu, setActiveMenu] = useState("Dashboard");
  const [products, setProducts] = useState([]);
  const [newProduct, setNewProduct] = useState(emptyProduct);
  const [newProductOpen, setNewProductOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [expandedImage, setExpandedImage] = useState(null);
  const [versionOpen, setVersionOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [syncMessage, setSyncMessage] = useState("Aguardando conexão com Supabase...");
  const [syncing, setSyncing] = useState(false);

  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState({ perfil: "administrador", nome: "Administrador" });
  const [profiles, setProfiles] = useState([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState("");

  const [extraCost, setExtraCost] = useState({ descricao: "", valor: "", data: "", estoqueAtual: "", estoqueMinimo: "" });
  const [nativeMascots, setNativeMascots] = useState(() => getStoredNativeMascots());
  const [customMascots, setCustomMascots] = useState([]);
  const [mascotForm, setMascotForm] = useState(emptyMascotForm);
  const [editingMascotId, setEditingMascotId] = useState(null);
  const [mascotUploading, setMascotUploading] = useState(false);
  const [animationMode, setAnimationMode] = useState(() => localStorage.getItem("j1_animation_mode") || "discreto");
  const [seenAlertKeys, setSeenAlertKeys] = useState(() => {
    try { return JSON.parse(localStorage.getItem("j1_seen_alerts") || "[]"); } catch { return []; }
  });
  const [monthAckKey, setMonthAckKey] = useState(() => localStorage.getItem("j1_month_ack") || currentMonthKey());
  const [extraCosts, setExtraCosts] = useState([]);

  const permissions = permissionsByRole[profile?.perfil || "visualizacao"] || permissionsByRole.visualizacao;
  const allMascots = useMemo(() => [...nativeMascots, ...customMascots], [nativeMascots, customMascots]);

  useEffect(() => {
    saveStoredNativeMascots(nativeMascots);
  }, [nativeMascots]);

  useEffect(() => {
    if (!supabase) {
      setLoadingAuth(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoadingAuth(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      loadUserProfile();
      loadProfiles();
      loadExtraCosts();
      loadMascots();
      loadProducts();
    }
  }, [user]);

  async function signIn() {
    if (!supabase) return setAuthError("Supabase não configurado.");
    setAuthError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setAuthError(error.message);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
  }

  async function loadUserProfile() {
    if (!supabase || !user) return;
    const { data } = await supabase.from("usuarios_perfis").select("*").eq("user_id", user.id).maybeSingle();
    if (data) return setProfile(data);

    const fallback = { user_id: user.id, email: user.email, nome: user.email, perfil: "administrador", status: "A" };
    await supabase.from("usuarios_perfis").insert(fallback);
    setProfile(fallback);
  }

  async function loadProfiles() {
    if (!supabase) return;
    const { data } = await supabase.from("usuarios_perfis").select("*").order("criado_em", { ascending: false });
    if (data) setProfiles(data);
  }

  async function loadExtraCosts() {
    if (!supabase) return;
    const { data } = await supabase.from("custos_extras").select("*").order("criado_em", { ascending: false });
    if (data) {
      setExtraCosts(data.map((c) => ({ id: c.id, descricao: c.descricao, valor: Number(c.valor || 0), data: c.criado_em ? formatDateBR(c.criado_em) : "", estoqueAtual: Number(c.estoque_atual || 0), estoqueMinimo: Number(c.estoque_minimo || 0) })));
    }
  }


  async function loadMascots() {
    if (!supabase) return;
    const { data, error } = await supabase.from("mascotes").select("*").order("criado_em", { ascending: false });
    if (error) {
      console.warn("Não foi possível carregar mascotes:", error.message);
      return;
    }

    setCustomMascots((data || []).map((m) => ({
      id: m.id,
      nome: m.nome || "Mascote",
      imagemUrl: m.imagem_url || "",
      tipo: m.tipo_movimento || "saltador",
      tamanho: m.tamanho || "medio",
      frequencia: m.frequencia || "normal",
      status: m.status || "A",
      origem: "Importado",
    })));
  }

  async function uploadMascotFile(file) {
    if (!supabase || !file) return "";

    const extension = file.name.split(".").pop()?.toLowerCase() || "png";
    if (!["png", "webp"].includes(extension)) {
      throw new Error("Use apenas arquivos PNG ou WebP para mascotes.");
    }

    const cleanName = file.name.replace(/[^\w.-]/g, "_");
    const path = `${user.id}/${crypto.randomUUID()}-${cleanName}`;

    const { error } = await supabase.storage.from(MASCOT_BUCKET).upload(path, file, { cacheControl: "3600", upsert: false });
    if (error) throw error;

    const { data } = supabase.storage.from(MASCOT_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  }

  function resetMascotForm() {
    setMascotForm(emptyMascotForm);
    setEditingMascotId(null);
  }

  function editMascot(mascot) {
    setEditingMascotId(mascot.id);
    setMascotForm({
      nome: mascot.nome || "",
      tipo: mascot.tipo || "saltador",
      tamanho: mascot.tamanho || "medio",
      frequencia: mascot.frequencia || "normal",
      status: mascot.status || "A",
      file: null,
      preview: mascot.imagemUrl || "",
      native: mascot.native || "",
      removerFundo: true,
      toleranciaFundo: "media",
    });
  }

  async function addMascot() {
    if (!permissions.canEdit && !permissions.canUsers) return alert("Seu perfil não permite cadastrar mascotes.");
    if (!mascotForm.nome) return alert("Informe o nome do mascote.");

    try {
      setMascotUploading(true);

      if (editingMascotId?.startsWith("native-")) {
        setNativeMascots((prev) => prev.map((m) => m.id === editingMascotId ? {
          ...m,
          nome: mascotForm.nome,
          tipo: mascotForm.tipo,
          tamanho: mascotForm.tamanho,
          frequencia: mascotForm.frequencia,
          status: mascotForm.status || "A",
        } : m));

        resetMascotForm();
        return;
      }

      if (editingMascotId) {
        const current = customMascots.find((m) => m.id === editingMascotId);
        if (!current) throw new Error("Mascote não encontrado.");

        const imagemUrl = mascotForm.file ? await uploadMascotFile(mascotForm.file) : current.imagemUrl;

        const row = {
          nome: mascotForm.nome,
          imagem_url: imagemUrl,
          tipo_movimento: mascotForm.tipo,
          tamanho: mascotForm.tamanho,
          frequencia: mascotForm.frequencia,
          status: mascotForm.status || "A",
        };

        const { data, error } = await supabase.from("mascotes").update(row).eq("id", editingMascotId).select().single();
        if (error) throw error;

        setCustomMascots((prev) => prev.map((m) => m.id === editingMascotId ? {
          id: data.id,
          nome: data.nome,
          imagemUrl: data.imagem_url,
          tipo: data.tipo_movimento,
          tamanho: data.tamanho,
          frequencia: data.frequencia,
          status: data.status,
          origem: "Importado",
        } : m));

        resetMascotForm();
        return;
      }

      if (!mascotForm.file) return alert("Selecione um PNG/WebP.");

      const imagemUrl = await uploadMascotFile(mascotForm.file);

      const row = {
        nome: mascotForm.nome,
        imagem_url: imagemUrl,
        tipo_movimento: mascotForm.tipo,
        tamanho: mascotForm.tamanho,
        frequencia: mascotForm.frequencia,
        status: "A",
      };

      const { data, error } = await supabase.from("mascotes").insert(row).select().single();
      if (error) throw error;

      setCustomMascots((prev) => [{
        id: data.id,
        nome: data.nome,
        imagemUrl: data.imagem_url,
        tipo: data.tipo_movimento,
        tamanho: data.tamanho,
        frequencia: data.frequencia,
        status: data.status,
        origem: "Importado",
      }, ...prev]);

      resetMascotForm();
    } catch (error) {
      alert(`Erro ao salvar mascote: ${error.message}`);
    } finally {
      setMascotUploading(false);
    }
  }

  async function toggleMascotStatus(id) {
    const native = nativeMascots.find((m) => m.id === id);

    if (native) {
      const nextStatus = native.status === "A" ? "X" : "A";
      setNativeMascots((prev) => prev.map((m) => m.id === id ? { ...m, status: nextStatus } : m));
      return;
    }

    const mascot = customMascots.find((m) => m.id === id);
    if (!mascot) return;

    const nextStatus = mascot.status === "A" ? "X" : "A";

    if (supabase) {
      const { error } = await supabase.from("mascotes").update({ status: nextStatus }).eq("id", id);
      if (error) return alert(`Erro ao alterar mascote: ${error.message}`);
    }

    setCustomMascots((prev) => prev.map((m) => m.id === id ? { ...m, status: nextStatus } : m));
  }

  async function removeMascot(id) {
    const native = nativeMascots.find((m) => m.id === id);

    if (native) {
      const confirmRemove = window.confirm("Deseja remover este mascote nativo da animação? Ele ficará inativo e poderá ser reativado depois.");
      if (!confirmRemove) return;
      setNativeMascots((prev) => prev.map((m) => m.id === id ? { ...m, status: "X" } : m));
      return;
    }

    const confirmDelete = window.confirm("Deseja remover este mascote importado?");
    if (!confirmDelete) return;

    if (supabase) {
      const { error } = await supabase.from("mascotes").delete().eq("id", id);
      if (error) return alert(`Erro ao remover mascote: ${error.message}`);
    }

    setCustomMascots((prev) => prev.filter((m) => m.id !== id));
  }

  async function loadProducts() {
    if (!supabase) {
      setSyncMessage("Configure as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.");
      return;
    }

    setSyncing(true);
    const { data, error } = await supabase
      .from("produtos")
      .select("*, produto_imagens(imagem_url), produto_custos_extras(id, custo_extra_id, descricao, valor)")
      .order("criado_em", { ascending: false });

    if (error) {
      setSyncMessage(`Erro ao carregar Supabase: ${error.message}`);
      setSyncing(false);
      return;
    }

    const converted = (data || []).map((p) => ({
      id: p.id,
      nome: p.nome || "",
      sku: p.sku || "",
      compra: Number(p.preco_compra || 0),
      chip: Number(p.chip || 0),
      frete: Number(p.frete || 0),
      manutencao: Number(p.manutencao || 0),
      outros: Number(p.outros || 0),
      vendaEsperada: Number(p.venda_esperada || 0),
      vendaReal: p.venda_real ?? "",
      status: p.status || "Em estoque",
      statusRegistro: p.status_registro || "A",
      statusVenda: p.status_venda || "A",
      estoqueMinimo: Number(p.estoque_minimo || 1),
      quantidade: Number(p.quantidade || 1),
      dataCompra: p.criado_em || "",
      dataVenda: p.data_venda || "",
      imagens: (p.produto_imagens || []).map((img) => img.imagem_url),
      custosExtras: (p.produto_custos_extras || []).map((c) => ({ id: c.id, custo_extra_id: c.custo_extra_id, descricao: c.descricao, valor: Number(c.valor || 0) })),
    }));

    setProducts(converted);
    setSyncMessage(converted.length ? "Produtos carregados do Supabase." : "Banco conectado. Nenhum produto salvo ainda.");
    setSyncing(false);
  }

  async function uploadImageFile(productId, image) {
    if (!supabase) return imageSrc(image);
    if (typeof image === "string") return image;
    if (!image?.file) return imageSrc(image);

    const extension = image.file.name.split(".").pop() || "jpg";
    const cleanName = image.file.name.replace(/[^\w.-]/g, "_");
    const path = `${user.id}/${productId}/${crypto.randomUUID()}-${cleanName}.${extension}`;

    const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, image.file, { cacheControl: "3600", upsert: false });
    if (error) throw error;

    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  }

  async function uploadImagesAndSaveRows(productId, images) {
    const urls = [];
    for (const image of (images || []).slice(0, 6)) {
      const url = await uploadImageFile(productId, image);
      if (url) urls.push(url);
    }

    if (urls.length) {
      await supabase.from("produto_imagens").insert(urls.map((url) => ({ produto_id: productId, imagem_url: url })));
    }
    return urls;
  }

  async function deleteImageFromStorageIfNeeded(url) {
    if (!supabase || !isStorageUrl(url)) return;
    const path = storagePathFromPublicUrl(url);
    if (path) await supabase.storage.from(STORAGE_BUCKET).remove([path]);
  }

  async function saveProductCosts(productId, costs) {
    if (!supabase) return;

    const { data: oldRows } = await supabase
      .from("produto_custos_extras")
      .select("custo_extra_id")
      .eq("produto_id", productId);

    const previousIds = (oldRows || []).map((row) => row.custo_extra_id).filter(Boolean);
    const nextIds = (costs || []).map((cost) => cost.custo_extra_id || cost.id).filter(Boolean);

    const addedIds = nextIds.filter((id) => !previousIds.includes(id));
    const removedIds = previousIds.filter((id) => !nextIds.includes(id));

    if (addedIds.length) {
      const { data: stockRows } = await supabase
        .from("custos_extras")
        .select("id, descricao, estoque_atual")
        .in("id", addedIds);

      const noStock = (stockRows || []).find((item) => Number(item.estoque_atual || 0) <= 0);
      if (noStock) {
        throw new Error(`Estoque indisponível para o custo extra: ${noStock.descricao}`);
      }

      for (const id of addedIds) {
        const item = (stockRows || []).find((row) => row.id === id);
        await supabase
          .from("custos_extras")
          .update({ estoque_atual: Math.max(0, Number(item?.estoque_atual || 0) - 1) })
          .eq("id", id);
      }
    }

    if (removedIds.length) {
      const { data: stockRows } = await supabase
        .from("custos_extras")
        .select("id, estoque_atual")
        .in("id", removedIds);

      for (const id of removedIds) {
        const item = (stockRows || []).find((row) => row.id === id);
        await supabase
          .from("custos_extras")
          .update({ estoque_atual: Number(item?.estoque_atual || 0) + 1 })
          .eq("id", id);
      }
    }

    await supabase.from("produto_custos_extras").delete().eq("produto_id", productId);

    if (costs?.length) {
      await supabase.from("produto_custos_extras").insert(
        costs.map((cost) => ({
          produto_id: productId,
          custo_extra_id: cost.custo_extra_id || cost.id || null,
          descricao: cost.descricao,
          valor: Number(cost.valor || 0),
        }))
      );
    }

    await loadExtraCosts();
  }

  const activeProducts = useMemo(() => products.filter((p) => p.statusRegistro !== "X"), [products]);
  const stockProducts = useMemo(() => activeProducts.filter((p) => p.status !== "Vendido"), [activeProducts]);
  const soldProducts = useMemo(() => activeProducts.filter((p) => p.status === "Vendido" && p.statusVenda !== "X"), [activeProducts]);
  const inactiveProducts = useMemo(() => products.filter((p) => p.statusRegistro === "X"), [products]);
  const financialProducts = useMemo(() => activeProducts.filter((p) => p.status !== "Vendido" || p.statusVenda !== "X"), [activeProducts]);
  const monthlyFinancialProducts = useMemo(() => financialProducts.filter((p) => {
    return monthKeyFromValue(productMovementDate(p)) === currentMonthKey();
  }), [financialProducts]);

  const summary = useMemo(() => {
    return monthlyFinancialProducts.reduce((acc, p) => {
      const calc = productMath(p);
      acc.capitalInvestido += calc.custoFinal;
      acc.lucroEsperado += calc.lucroEsperado;
      acc.valorEstoque += p.status === "Vendido" ? 0 : calc.custoFinal;
      acc.produtosEstoque += p.status === "Vendido" ? 0 : 1;
      acc.produtosVendidos += p.status === "Vendido" ? 1 : 0;
      acc.receitaReal += p.status === "Vendido" ? Number(p.vendaReal || 0) : 0;
      acc.lucroReal += calc.lucroReal;
      acc.custoVendidos += p.status === "Vendido" ? calc.custoFinal : 0;
      acc.compra += Number(p.compra || 0);
      acc.custosExtras += calc.custosExtras;
      return acc;
    }, { capitalInvestido: 0, lucroEsperado: 0, valorEstoque: 0, produtosEstoque: 0, produtosVendidos: 0, receitaReal: 0, lucroReal: 0, custoVendidos: 0, compra: 0, custosExtras: 0 });
  }, [monthlyFinancialProducts]);

  const totalExtraCosts = extraCosts.reduce((acc, item) => acc + Number(item.valor || 0), 0);
  const roiPercent = summary.capitalInvestido ? (summary.lucroReal / summary.capitalInvestido) * 100 : 0;
  
  const monthlyHistory = useMemo(() => {
    const map = new Map();

    for (const p of financialProducts) {
      const key = monthKeyFromValue(productMovementDate(p));
      if (!key) continue;

      if (!map.has(key)) {
        map.set(key, {
          key,
          label: monthLabelFromKey(key),
          capital: 0,
          faturamento: 0,
          lucroReal: 0,
          vendidos: 0,
          roi: 0,
        });
      }

      const row = map.get(key);
      const calc = productMath(p);
      row.capital += calc.custoFinal;

      if (p.status === "Vendido" && p.statusVenda !== "X") {
        row.faturamento += Number(p.vendaReal || 0);
        row.lucroReal += calc.lucroReal;
        row.vendidos += 1;
      }
    }

    return Array.from(map.values())
      .map((row) => ({ ...row, roi: row.capital ? (row.lucroReal / row.capital) * 100 : 0 }))
      .sort((a, b) => b.key.localeCompare(a.key));
  }, [financialProducts]);

const lowStockProducts = stockProducts.filter((p) => Number(p.quantidade || 0) <= Number(p.estoqueMinimo || 0));

  
  const stockAlerts = useMemo(() => {
    return extraCosts
      .filter((cost) => Number(cost.estoqueAtual || 0) <= Number(cost.estoqueMinimo || 0))
      .map((cost) => ({
        key: `extra-stock-${cost.id}`,
        type: "stock",
        title: `${cost.descricao} está com estoque baixo`,
        message: `Estoque atual: ${Number(cost.estoqueAtual || 0)} | Mínimo: ${Number(cost.estoqueMinimo || 0)}`,
      }));
  }, [extraCosts]);

  const monthChangeAlert = useMemo(() => {
    const actual = currentMonthKey();
    if (!monthAckKey || monthAckKey === actual) return null;
    return {
      key: `month-change-${actual}`,
      type: "month",
      title: "Mês vigente alterado",
      message: "Verifique seu lucro e valores no histórico de vendas mensal.",
    };
  }, [monthAckKey]);

  const systemAlerts = useMemo(() => {
    return [...(monthChangeAlert ? [monthChangeAlert] : []), ...stockAlerts];
  }, [monthChangeAlert, stockAlerts]);

  const unreadAlerts = useMemo(() => {
    return systemAlerts.filter((alert) => !seenAlertKeys.includes(alert.key));
  }, [systemAlerts, seenAlertKeys]);

  function markAlertAsSeen(key) {
    setSeenAlertKeys((prev) => prev.includes(key) ? prev : [...prev, key]);
    if (key.startsWith("month-change-")) {
      localStorage.setItem("j1_month_ack", currentMonthKey());
      setMonthAckKey(currentMonthKey());
    }
  }

  function markAllAlertsAsSeen() {
    setSeenAlertKeys((prev) => Array.from(new Set([...prev, ...systemAlerts.map((alert) => alert.key)])));
    localStorage.setItem("j1_month_ack", currentMonthKey());
    setMonthAckKey(currentMonthKey());
  }

const costDistribution = [
    ["Compras", summary.compra, "bar-white"],
    ["Custos agregados", summary.custosExtras, "bar-red"],
  ];

  const menus = [
    ["Dashboard", LayoutDashboard],
    ["Produtos", Package],
    ["Vendas", ShoppingCart],
    ["Compras", ReceiptText],
    ["Custos Extras", Wallet],
    ["Relatórios", BarChart3],
    ["Financeiro", DollarSign],
    ["Usuários", Users],
    ["Manutenção", Wrench],
  ];

  const showStats = activeMenu === "Dashboard" || activeMenu === "Relatórios";

  const calendarEvents = useMemo(() => buildCalendarEvents(financialProducts), [financialProducts]);

  function readImages(event, callback) {
    const files = Array.from(event.target.files || []);
    const selected = files.map((file) => ({ file, preview: URL.createObjectURL(file) }));
    callback(selected);
    event.target.value = "";
  }

  function importNewImages(event) {
    readImages(event, (images) => {
      setNewProduct((prev) => {
        const current = prev.imagens || [];
        const remaining = Math.max(0, 6 - current.length);
        return { ...prev, imagens: [...current, ...images.slice(0, remaining)] };
      });
    });
  }

  function importEditImages(event) {
    readImages(event, (images) => {
      setEditingProduct((prev) => {
        const current = prev.imagens || [];
        const remaining = Math.max(0, 6 - current.length);
        return { ...prev, imagens: [...current, ...images.slice(0, remaining)] };
      });
    });
  }

  async function addProduct() {
    if (!permissions.canCreate) return alert("Seu perfil não permite cadastrar produtos.");
    if (!newProduct.nome || !newProduct.compra || !newProduct.vendaEsperada) return;

    const product = {
      id: crypto.randomUUID(),
      ...newProduct,
      sku: newProduct.sku || `SKU-${activeProducts.length + 1}`,
      compra: Number(newProduct.compra || 0),
      vendaEsperada: Number(newProduct.vendaEsperada || 0),
      vendaReal: "",
      status: "Em estoque",
      statusRegistro: "A",
      estoqueMinimo: Number(newProduct.estoqueMinimo || 1),
      quantidade: Number(newProduct.quantidade || 1),
      dataCompra: new Date().toISOString(),
      dataVenda: "",
      imagens: newProduct.imagens.length ? newProduct.imagens : [placeholderImage("NOVO")],
      custosExtras: newProduct.custosExtras || [],
    };

    if (!supabase) return;

    const calc = productMath(product);
    setSyncing(true);
    setSyncMessage("Salvando produto no Supabase...");

    const { data, error } = await supabase
      .from("produtos")
      .insert({
        nome: product.nome,
        sku: product.sku,
        preco_compra: product.compra,
        chip: 0,
        frete: 0,
        manutencao: 0,
        outros: 0,
        custo_final: calc.custoFinal,
        venda_esperada: product.vendaEsperada,
        venda_real: null,
        lucro_esperado: calc.lucroEsperado,
        lucro_real: null,
        status: product.status,
        status_registro: "A",
        estoque_minimo: product.estoqueMinimo,
        quantidade: product.quantidade,
        data_venda: null,
      })
      .select()
      .single();

    if (error) {
      setSyncMessage(`Erro ao salvar: ${error.message}`);
      setSyncing(false);
      return;
    }

    try {
      const urls = await uploadImagesAndSaveRows(data.id, product.imagens);
      await saveProductCosts(data.id, product.custosExtras);
      const saved = { ...product, id: data.id, dataCompra: data.criado_em || product.dataCompra, imagens: urls };
      setProducts((prev) => [saved, ...prev]);
      setNewProduct(emptyProduct);
      setNewProductOpen(false);
      setSyncMessage("Produto salvo com custos agregados.");
    } catch (error) {
      setSyncMessage(`Produto salvo, mas houve erro complementar: ${error.message}`);
    }

    setSyncing(false);
  }

  function updateProduct(id, field, value) {
    const textFields = ["nome", "sku", "status", "dataVenda"];
    setProducts((prev) => prev.map((product) => product.id === id ? { ...product, [field]: textFields.includes(field) ? value : value === "" ? "" : Number(value) } : product));
  }

  async function sellProduct(id) {
    if (!permissions.canSell) return alert("Seu perfil não permite marcar venda.");
    const target = products.find((p) => p.id === id);
    if (!target) return;

    const soldAt = new Date().toISOString();
    const next = { ...target, status: "Vendido", vendaReal: target.vendaReal || target.vendaEsperada, dataVenda: soldAt };
    const calc = productMath(next);

    setProducts((prev) => prev.map((p) => (p.id === id ? next : p)));

    if (supabase) {
      await supabase.from("produtos").update({ status: "Vendido", status_venda: "A", venda_real: Number(next.vendaReal || 0), lucro_real: calc.lucroReal, data_venda: soldAt }).eq("id", id);
    }
  }


  async function cancelSale(id) {
    if (!permissions.canSell) return alert("Seu perfil não permite cancelar vendas.");

    const target = products.find((p) => p.id === id);
    if (!target) return;

    const confirmCancel = window.confirm("Deseja cancelar esta venda? Ela não será somada no Dashboard, Relatórios, Financeiro e Calendário.");
    if (!confirmCancel) return;

    if (supabase) {
      const { error } = await supabase
        .from("produtos")
        .update({
          status_venda: "X",
          status: "Em estoque",
          venda_real: null,
          lucro_real: null,
          data_venda: null,
        })
        .eq("id", id);

      if (error) return alert(`Erro ao cancelar venda: ${error.message}`);
    }

    setProducts((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, statusVenda: "X", status: "Em estoque", vendaReal: "", dataVenda: "" }
          : p
      )
    );
  }

  async function saveEdit() {
    if (!permissions.canEdit) return alert("Seu perfil não permite editar produtos.");
    if (!editingProduct || !supabase) return;

    setSyncing(true);
    setSyncMessage("Salvando alterações no Supabase...");

    const calc = productMath(editingProduct);
    const { error } = await supabase.from("produtos").update({
      nome: editingProduct.nome,
      sku: editingProduct.sku,
      preco_compra: Number(editingProduct.compra || 0),
      chip: 0,
      frete: 0,
      manutencao: 0,
      outros: 0,
      custo_final: calc.custoFinal,
      venda_esperada: Number(editingProduct.vendaEsperada || 0),
      venda_real: editingProduct.vendaReal === "" ? null : Number(editingProduct.vendaReal || 0),
      lucro_esperado: calc.lucroEsperado,
      lucro_real: editingProduct.status === "Vendido" ? calc.lucroReal : null,
      status: editingProduct.status || "Em estoque",
      estoque_minimo: Number(editingProduct.estoqueMinimo || 1),
      quantidade: Number(editingProduct.quantidade || 1),
      data_venda: editingProduct.status === "Vendido" ? (editingProduct.dataVenda || new Date().toISOString()) : null,
    }).eq("id", editingProduct.id);

    if (error) {
      setSyncMessage(`Erro ao editar: ${error.message}`);
      setSyncing(false);
      return;
    }

    const { data: oldRows } = await supabase.from("produto_imagens").select("imagem_url").eq("produto_id", editingProduct.id);
    const oldUrls = (oldRows || []).map((row) => row.imagem_url);
    const keptExistingUrls = (editingProduct.imagens || []).filter((img) => typeof img === "string");
    const removedUrls = oldUrls.filter((url) => !keptExistingUrls.includes(url));
    for (const url of removedUrls) await deleteImageFromStorageIfNeeded(url);

    await supabase.from("produto_imagens").delete().eq("produto_id", editingProduct.id);
    const finalUrls = await uploadImagesAndSaveRows(editingProduct.id, editingProduct.imagens || []);
    await saveProductCosts(editingProduct.id, editingProduct.custosExtras || []);

    setProducts((prev) => prev.map((item) => item.id === editingProduct.id ? { ...editingProduct, imagens: finalUrls } : item));
    setEditingProduct(null);
    setSyncMessage("Produto editado com sucesso.");
    setSyncing(false);
  }

  async function removeProduct(id) {
    if (!permissions.canDelete) {
      alert("Seu perfil não permite excluir produtos.");
      return false;
    }

    const confirmDelete = window.confirm("Deseja inativar este produto? O registro será mantido no banco com status X.");
    if (!confirmDelete) return false;

    if (supabase) {
      const { error } = await supabase.from("produtos").update({ status_registro: "X" }).eq("id", id);
      if (error) {
        alert(`Erro ao inativar produto: ${error.message}`);
        return false;
      }
    }

    setProducts((prev) => prev.map((item) => item.id === id ? { ...item, statusRegistro: "X" } : item));
    return true;
  }

  async function deleteEditingProduct() {
    if (!editingProduct) return;
    const success = await removeProduct(editingProduct.id);
    if (success) setEditingProduct(null);
  }

  async function restoreProduct(id) {
    if (supabase) await supabase.from("produtos").update({ status_registro: "A" }).eq("id", id);
    setProducts((prev) => prev.map((item) => item.id === id ? { ...item, statusRegistro: "A" } : item));
  }

  async function removeExtraCost(id) {
    if (supabase) await supabase.from("custos_extras").delete().eq("id", id);
    setExtraCosts((prev) => prev.filter((item) => item.id !== id));
  }

  async function addExtraCost() {
    if (!extraCost.descricao || !extraCost.valor) return;

    if (supabase) {
      const { data } = await supabase
        .from("custos_extras")
        .insert({
          descricao: extraCost.descricao,
          valor: Number(extraCost.valor || 0),
          estoque_atual: Number(extraCost.estoqueAtual || 0),
          estoque_minimo: Number(extraCost.estoqueMinimo || 0),
        })
        .select()
        .single();

      if (data) {
        setExtraCosts((prev) => [{
          id: data.id,
          descricao: data.descricao,
          valor: Number(data.valor || 0),
          data: data.criado_em ? formatDateBR(data.criado_em) : "Hoje",
          estoqueAtual: Number(data.estoque_atual || 0),
          estoqueMinimo: Number(data.estoque_minimo || 0),
        }, ...prev]);
      }
    }

    setExtraCost({ descricao: "", valor: "", data: "", estoqueAtual: "", estoqueMinimo: "" });
  }

  function exportBackup() {
    if (!permissions.canBackup) return alert("Seu perfil não permite backup.");
    const backup = { gerado_em: new Date().toISOString(), versao: APP_VERSION, produtos: activeProducts, produtos_inativos: inactiveProducts, custos_extras: extraCosts, resumo: summary };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const element = document.createElement("a");
    element.href = url;
    element.download = `backup-jogador1-games-v${APP_VERSION}-${new Date().toISOString().slice(0, 10)}.json`;
    element.click();
    URL.revokeObjectURL(url);
  }

  function exportPdf() {
    window.print();
  }

  async function updateProfileRole(profileId, perfil) {
    if (!permissions.canUsers) return alert("Seu perfil não permite alterar usuários.");
    await supabase.from("usuarios_perfis").update({ perfil }).eq("id", profileId);
    loadProfiles();
  }

  function renderModule() {
    if (activeMenu === "Produtos") {
      return (
        <ModuleCard title="Produtos" subtitle="Cadastro, edição, imagem e controle de estoque.">
          <div className="module-actions">{permissions.canCreate && <button onClick={() => setNewProductOpen(true)}><Plus size={17} /> Cadastrar Produto</button>}</div>
          <ProductsTable products={stockProducts} updateProduct={updateProduct} sellProduct={sellProduct} editProduct={setEditingProduct} removeProduct={removeProduct} setExpandedImage={setExpandedImage} permissions={permissions} />
        </ModuleCard>
      );
    }

    if (activeMenu === "Vendas") {
      return (
        <ModuleCard title="Vendas" subtitle="Produtos vendidos, valor realizado e lucro real.">
          <SimpleTable headers={["Produto", "Data", "Venda real", "Custo", "Lucro real", "Ações"]}>
            {soldProducts.map((p) => {
              const calc = productMath(p);
              return (
                <tr key={p.id}>
                  <td>
                    <div className="sale-product-cell">
                      <button className="sale-thumb" onClick={() => setExpandedImage(imageSrc(p.imagens?.[0]))}>
                        {p.imagens?.[0] ? <img src={imageSrc(p.imagens[0])} alt={p.nome} /> : <ImagePlus size={18} />}
                      </button>
                      <strong>{p.nome}</strong>
                    </div>
                  </td>
                  <td>{formatDateBR(productSaleDate(p))}</td>
                  <td className="green">{currency(p.vendaReal)}</td>
                  <td>{currency(calc.custoFinal)}</td>
                  <td className="green strong">{currency(calc.lucroReal)}</td>
                  <td>
                    <div className="sales-actions-cell">
                      {permissions.canEdit && (
                        <button className="icon-btn" title="Editar venda" onClick={() => setEditingProduct(p)}>
                          <Pencil size={17} />
                        </button>
                      )}
                      {permissions.canSell && (
                        <button className="icon-btn danger" title="Cancelar venda" onClick={() => cancelSale(p.id)}>
                          <X size={18} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </SimpleTable>
        </ModuleCard>
      );
    }

    if (activeMenu === "Compras") {
      return (
        <ModuleCard title="Compras" subtitle="Produtos comprados e capital aplicado.">
          <SimpleTable headers={["Produto", "SKU", "Data", "Compra", "Custos agregados", "Custo final", "Status"]}>
            {activeProducts.map((p) => {
              const calc = productMath(p);
              return <tr key={p.id}><td>{p.nome}</td><td>{p.sku}</td><td>{formatDateBR(p.dataCompra)}</td><td>{currency(p.compra)}</td><td>{currency(calc.custosExtras)}</td><td className="strong">{currency(calc.custoFinal)}</td><td><Status status={p.status} /></td></tr>;
            })}
          </SimpleTable>
        </ModuleCard>
      );
    }

    if (activeMenu === "Custos Extras") {
      return (
        <ModuleCard title="Custos Extras" subtitle="Cadastre itens agregáveis ao custo dos produtos com controle de estoque.">
          <div className="extra-cost-form extra-cost-form-v4">
            <input placeholder="Descrição. Ex: Chip, Película, Frete" value={extraCost.descricao} onChange={(e) => setExtraCost({ ...extraCost, descricao: e.target.value })} />
            <input type="number" placeholder="Valor" value={extraCost.valor} onChange={(e) => setExtraCost({ ...extraCost, valor: e.target.value })} />
            <input type="number" placeholder="Estoque atual" value={extraCost.estoqueAtual} onChange={(e) => setExtraCost({ ...extraCost, estoqueAtual: e.target.value })} />
            <input type="number" placeholder="Estoque mínimo" value={extraCost.estoqueMinimo} onChange={(e) => setExtraCost({ ...extraCost, estoqueMinimo: e.target.value })} />
            <input type="date" value={extraCost.data} onChange={(e) => setExtraCost({ ...extraCost, data: e.target.value })} />
            <button onClick={addExtraCost}><Plus size={17} /></button>
          </div>
          <SimpleTable headers={["Descrição", "Data", "Valor", "Estoque atual", "Estoque mínimo", ""]}>
            {extraCosts.map((cost) => (
              <tr key={cost.id} className={Number(cost.estoqueAtual || 0) <= Number(cost.estoqueMinimo || 0) ? "low-stock-row" : ""}>
                <td>{cost.descricao}</td>
                <td>{cost.data}</td>
                <td className="red">{currency(cost.valor)}</td>
                <td className="green strong">{Number(cost.estoqueAtual || 0)}</td>
                <td>{Number(cost.estoqueMinimo || 0)}</td>
                <td className="right"><button className="icon-btn danger" onClick={() => removeExtraCost(cost.id)}><Trash2 size={18} /></button></td>
              </tr>
            ))}
          </SimpleTable>
        </ModuleCard>
      );
    }

    if (activeMenu === "Relatórios") {
      return (
        <div className="report-layout">
          <ModuleCard title="Relatórios" subtitle="Visão consolidada da operação.">
            <div className="module-actions report-actions"><button onClick={exportPdf}><Download size={17} /> Gerar PDF</button><button onClick={exportBackup}><Download size={17} /> Backup JSON</button></div>
            <div className="report-grid"><MiniReport title="Estoque" value={currency(summary.valorEstoque)} desc="Capital parado" /><MiniReport title="Vendas" value={currency(summary.receitaReal)} desc="Receita realizada" /><MiniReport title="Lucro real" value={currency(summary.lucroReal)} desc="Soma dos lucros reais das vendas válidas" /><MiniReport title="Retorno sobre Capital" value={`${roiPercent.toFixed(2).replace(".", ",")}%`} desc={`A cada R$ 100 investidos, retornaram R$ ${roiPercent.toFixed(2).replace(".", ",")} de lucro`} /><MiniReport title="Produtos vendidos" value={soldProducts.length} desc="Histórico de vendas" /></div>
            <CostDistribution costs={costDistribution} summary={summary} />
          </ModuleCard>
          <ModuleCard title="Gráficos financeiros" subtitle="Indicadores visuais"><FinanceCharts summary={summary} /></ModuleCard>
          <ModuleCard title="Histórico mensal" subtitle="Fechamentos por mês"><MonthlyHistory data={monthlyHistory} /></ModuleCard><ModuleCard title="Movimentações por data" subtitle="Compras e vendas registradas"><CalendarEventList events={calendarEvents} /></ModuleCard>
        </div>
      );
    }

    if (activeMenu === "Financeiro") {
      if (!permissions.canFinancial) return <NoPermission />;
      return <ModuleCard title="Financeiro" subtitle="Resumo do caixa, lucro e resultado das vendas."><div className="two-columns"><FinancialSummary summary={summary} /><ModuleCard title="Caixa Operacional" subtitle="Resumo rápido"><Line label="Receita Real" value={currency(summary.receitaReal)} good /><Line label="Custo dos vendidos" value={`-${currency(summary.custoVendidos)}`} bad /><Line label="Lucro Real" value={currency(summary.lucroReal)} good /><Line label="ROI" value={`${roiPercent.toFixed(2).replace(".", ",")}%`} good /></ModuleCard></div></ModuleCard>;
    }

    if (activeMenu === "Usuários") {
      if (!permissions.canUsers) return <NoPermission />;
      return <ModuleCard title="Usuários e Permissões" subtitle="Controle de acesso por perfil."><SimpleTable headers={["Nome", "E-mail", "Perfil", "Status"]}>{profiles.map((p) => <tr key={p.id || p.user_id}><td>{p.nome || "-"}</td><td>{p.email}</td><td><select value={p.perfil} onChange={(e) => updateProfileRole(p.id, e.target.value)}><option value="administrador">Administrador</option><option value="funcionario">Funcionário</option><option value="visualizacao">Visualização</option></select></td><td>{p.status || "A"}</td></tr>)}</SimpleTable></ModuleCard>;
    }

    if (activeMenu === "Manutenção") {
      return (
        <div className="maintenance-grid">
          <ModuleCard title="Configurações visuais" subtitle="Controle das animações e do Mundo dos Mascotes.">
            <div className="settings-row">
              <label>Animações de fundo</label>
              <select value={animationMode} onChange={(e) => setAnimationMode(e.target.value)}>
                <option value="desativado">Desativado</option>
                <option value="discreto">Discreto</option>
                <option value="gamer">Gamer</option>
              </select>
            </div>
          </ModuleCard>

          <MascotManager
            mascots={allMascots}
            form={mascotForm}
            setForm={setMascotForm}
            onAdd={addMascot}
            onEdit={editMascot}
            onCancelEdit={resetMascotForm}
            onToggle={toggleMascotStatus}
            onRemove={removeMascot}
            uploading={mascotUploading}
            editingMascotId={editingMascotId}
          />

          <ModuleCard title="Produtos inativos" subtitle="Produtos com status de registro X.">
            <SimpleTable headers={["Produto", "SKU", "Status", "Ação"]}>{inactiveProducts.map((p) => <tr key={p.id}><td>{p.nome}</td><td>{p.sku}</td><td>X</td><td><button onClick={() => restoreProduct(p.id)}>Restaurar</button></td></tr>)}</SimpleTable>
          </ModuleCard>
        </div>
      );
    }

    return (
      <div className="dashboard-sales-management">
        <ModuleCard title="Gerenciamento de Vendas" subtitle="Produtos disponíveis para venda, custos, preço esperado e lucro.">
          <div className="module-actions dashboard-sales-actions">{permissions.canCreate && <button onClick={() => setNewProductOpen(true)}><Plus size={17} /> Novo Produto</button>}</div>
          <ProductsTable products={stockProducts} updateProduct={updateProduct} sellProduct={sellProduct} editProduct={setEditingProduct} removeProduct={removeProduct} setExpandedImage={setExpandedImage} permissions={permissions} />
        </ModuleCard>
      </div>
    );  }

  if (loadingAuth) return <div className="login-screen"><div className="login-card"><h1>Jogador1 Games</h1><p>Carregando sessão...</p></div></div>;

  if (!user) {
    return (
      <div className="login-screen">
        <div className="login-card">
          <div className="login-logo"><Gamepad2 size={50} /></div>
          <h1>Jogador<span>1</span> Games</h1>
          <p>Sistema Premium de Estoque</p>
          <input type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input type="password" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} />
          {authError && <small className="auth-error">{authError}</small>}
          <button onClick={signIn}>Entrar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <BackgroundAnimations mode={animationMode} mascots={allMascots} />
      {expandedImage && <div className="image-overlay" onClick={() => setExpandedImage(null)}><img src={expandedImage} alt="Produto ampliado" /></div>}
      {calendarOpen && <CalendarModal events={calendarEvents} onClose={() => setCalendarOpen(false)} />}
      {alertsOpen && <AlertsModal alerts={systemAlerts} unreadKeys={unreadAlerts.map((alert) => alert.key)} onClose={() => setAlertsOpen(false)} onMarkSeen={markAlertAsSeen} onMarkAll={markAllAlertsAsSeen} />}
      {versionOpen && <VersionModal onClose={() => setVersionOpen(false)} />}

      {newProductOpen && <ProductModal title="Cadastrar novo produto" product={newProduct} setProduct={setNewProduct} onClose={() => setNewProductOpen(false)} onSave={addProduct} saveText="Adicionar ao estoque" importImages={importNewImages} removeImage={(index) => setNewProduct((prev) => ({ ...prev, imagens: prev.imagens.filter((_, i) => i !== index) }))} setExpandedImage={setExpandedImage} extraCosts={extraCosts} />}

      {editingProduct && <ProductModal title={editingProduct.status === "Vendido" ? "Editar venda concluída" : "Editar produto"} product={editingProduct} setProduct={setEditingProduct} onClose={() => setEditingProduct(null)} onSave={saveEdit} onDelete={deleteEditingProduct} saveText="Salvar alterações" importImages={importEditImages} removeImage={(index) => setEditingProduct((prev) => ({ ...prev, imagens: prev.imagens.filter((_, i) => i !== index) }))} setExpandedImage={setExpandedImage} extraCosts={extraCosts} editing />}

      <div className="layout">
        <aside className="sidebar">
          <div className="brand"><div className="brand-icon"><Gamepad2 size={54} /></div><h1>JOGADOR<span>1</span></h1><p>GAMES</p></div>
          <nav>{menus.map(([label, Icon]) => <button key={label} type="button" onClick={() => setActiveMenu(label)} className={activeMenu === label ? "active" : ""}><Icon size={18} />{label}</button>)}</nav>
          <div className="sidebar-profit"><p>Lucro real vendido</p><strong>{currency(summary.lucroReal)}</strong><small>Perfil: {profile?.perfil}</small></div>
          <button className="logout-btn" onClick={signOut}><LogOut size={16} />Sair</button>
        </aside>

        <main className="content">
          <header className="topbar">
            <div className="topbar-title"><div className="topbar-icon"><LayoutDashboard size={24} /></div><div><h2>{activeMenu}</h2><p>Rotina ativa do sistema Jogador1 Games.</p><small>{syncing ? "Sincronizando..." : syncMessage}</small></div></div>
            <div className="topbar-actions"><button className={unreadAlerts.length ? "alert-bell has-alerts" : "alert-bell"} onClick={() => setAlertsOpen(true)}><Bell size={19} />{unreadAlerts.length > 0 && <span>{unreadAlerts.length}</span>}</button><button className="date-pill" onClick={() => setCalendarOpen(true)}><CalendarDays size={17} /> {currentMonthLabel()}</button><div className="capital-pill"><p>Capital total</p><strong>{currency(summary.capitalInvestido)}</strong></div></div>
          </header>

          {showStats && <section className="stats"><Stat icon={Wallet} title="Capital Investido" value={currency(summary.capitalInvestido)} subtitle="Total aplicado" color="red" /><Stat icon={Boxes} title="Valor em Estoque" value={currency(summary.valorEstoque)} subtitle="Não vendidos" color="white" /><Stat icon={TrendingUp} title="Lucro Esperado" value={currency(summary.lucroEsperado)} subtitle="Venda prevista" color="green" /><Stat icon={DollarSign} title="Lucro Real" value={currency(summary.lucroReal)} subtitle="Vendas válidas" color="real-profit" /><Stat icon={TrendingUp} title="Retorno sobre Capital" value={`${roiPercent.toFixed(2).replace(".", ",")}%`} subtitle="Lucro sobre capital" color="green" /><Stat icon={Package} title="Produtos em Estoque" value={summary.produtosEstoque} subtitle="Disponíveis" color="amber" /></section>}

          {renderModule()}
          <footer className="version-footer">Atualizado com a versão {APP_VERSION}. <button onClick={() => setVersionOpen(true)}>Clique aqui e saiba as novidades.</button></footer>
        </main>
      </div>
    </div>
  );
}

function buildCalendarEvents(products) {
  const map = new Map();
  for (const p of products) {
    const purchaseKey = dateKey(p.dataCompra);
    if (purchaseKey) {
      if (!map.has(purchaseKey)) map.set(purchaseKey, { date: purchaseKey, compras: [], vendas: [] });
      map.get(purchaseKey).compras.push({ nome: p.nome, valor: Number(p.compra || 0) });
    }

    if (p.status === "Vendido") {
      const saleKey = dateKey(productSaleDate(p));
      if (saleKey) {
        if (!map.has(saleKey)) map.set(saleKey, { date: saleKey, compras: [], vendas: [] });
        map.get(saleKey).vendas.push({ nome: p.nome, valor: Number(p.vendaReal || 0) });
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
}

function ProductModal({ title, product, setProduct, onClose, onSave, onDelete, saveText, importImages, removeImage, setExpandedImage, extraCosts, editing }) {
  const cost = productMath(product).custoFinal;
  const profit = Number(product.vendaEsperada || 0) - cost;

  function toggleExtraCost(costItem) {
    const current = product.custosExtras || [];
    const exists = current.some((item) => (item.custo_extra_id || item.id) === costItem.id);
    if (exists) {
      setProduct({ ...product, custosExtras: current.filter((item) => (item.custo_extra_id || item.id) !== costItem.id) });
    } else {
      if (Number(costItem.estoqueAtual || 0) <= 0) {
        alert(`Estoque indisponível para: ${costItem.descricao}`);
        return;
      }
      setProduct({ ...product, custosExtras: [...current, { custo_extra_id: costItem.id, descricao: costItem.descricao, valor: Number(costItem.valor || 0) }] });
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="product-modal">
        <div className="modal-header"><div><h2>{title}</h2><p>{product.status === "Vendido" ? "Ajuste venda real, data, custos e informações do produto vendido." : "Preencha a compra, selecione custos extras e importe até 6 imagens."}</p></div><button onClick={onClose}><X size={18} /> Fechar</button></div>
        <div className="modal-grid">
          <div className="modal-left">
            <FormSection title="Identificação"><div className="form-grid"><input value={product.nome} onChange={(e) => setProduct({ ...product, nome: e.target.value })} placeholder="Nome do produto" /><input value={product.sku} onChange={(e) => setProduct({ ...product, sku: e.target.value })} placeholder="SKU / Código interno" /></div></FormSection>
            <FormSection title="Estoque"><div className="form-grid"><input type="number" value={product.quantidade} onChange={(e) => setProduct({ ...product, quantidade: e.target.value })} placeholder="Quantidade" /><input type="number" value={product.estoqueMinimo} onChange={(e) => setProduct({ ...product, estoqueMinimo: e.target.value })} placeholder="Estoque mínimo" /></div></FormSection>
            <FormSection title="Custo do produto"><div className="form-grid single"><input type="number" value={product.compra} onChange={(e) => setProduct({ ...product, compra: e.target.value })} placeholder="Preço de compra" /></div><ExtraCostSelector extraCosts={extraCosts} selected={product.custosExtras || []} toggleExtraCost={toggleExtraCost} /></FormSection>
            <FormSection title="Venda"><div className="form-grid"><input type="number" value={product.vendaEsperada} onChange={(e) => setProduct({ ...product, vendaEsperada: e.target.value })} placeholder="Valor esperado de venda" />{editing && <input type="number" value={product.vendaReal} onChange={(e) => setProduct({ ...product, vendaReal: e.target.value })} placeholder="Venda real" />}{editing && product.status === "Vendido" && <input type="date" value={dateKey(product.dataVenda || product.dataCompra)} onChange={(e) => setProduct({ ...product, dataVenda: e.target.value })} title="Data da venda" />}</div></FormSection>
          </div>
          <div className="modal-right"><FormSection title="Imagens"><input className="file-input" type="file" accept="image/*" multiple onChange={importImages} /><p className="muted">Você pode importar em etapas, até completar 6 imagens.</p><ImagesGrid images={product.imagens} removeImage={removeImage} setExpandedImage={setExpandedImage} /></FormSection><div className="profit-box"><p>Custo final estimado</p><strong>{currency(cost)}</strong><p>Lucro esperado</p><strong className="green">{currency(profit)}</strong></div><div className="modal-action-buttons">{editing && onDelete && <button onClick={onDelete} className="delete-product-button"><Trash2 size={18} /> Excluir produto</button>}<button onClick={onSave} className="full-button"><Plus size={18} /> {saveText}</button></div></div>
        </div>
      </div>
    </div>
  );
}

function ExtraCostSelector({ extraCosts, selected, toggleExtraCost }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="extra-selector">
      <button type="button" className="extra-open-button" onClick={() => setOpen(true)}>
        <Plus size={16} /> Custos extras
      </button>

      {!selected.length && <p className="muted extra-hint">Nenhum custo extra aplicado neste produto.</p>}

      {!!selected.length && (
        <div className="selected-extra-list">
          {selected.map((item) => {
            const key = item.custo_extra_id || item.id;
            return (
              <span key={key} className="selected-extra-chip">
                <span>{item.descricao} • {currency(item.valor)}</span>
                <button
                  type="button"
                  className="selected-extra-remove"
                  title="Remover custo deste produto"
                  onClick={() => toggleExtraCost({ id: key })}
                >
                  <Trash2 size={13} />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {open && (
        <div className="nested-modal-backdrop">
          <div className="extra-cost-modal">
            <div className="modal-header">
              <div>
                <h2>Selecionar custos extras</h2>
                <p>Escolha apenas os custos que serão agregados a este produto.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)}><X size={18} /> Fechar</button>
            </div>

            {!extraCosts.length && <p className="muted">Cadastre custos no menu Custos Extras para usar aqui.</p>}

            <div className="extra-cost-options">
              {extraCosts.map((cost) => {
                const checked = selected.some((item) => (item.custo_extra_id || item.id) === cost.id);
                return (
                  <button
                    key={cost.id}
                    type="button"
                    className={checked ? "extra-option selected" : "extra-option"}
                    onClick={() => toggleExtraCost(cost)}
                  >
                    <span>{checked ? "✓" : "+"}</span>
                    <div>
                      <strong>{cost.descricao}</strong>
                      <small>{currency(cost.valor)} • Estoque: {Number(cost.estoqueAtual || 0)}</small>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


function AlertsModal({ alerts, unreadKeys, onClose, onMarkSeen, onMarkAll }) {
  return (
    <div className="modal-backdrop">
      <div className="version-modal alerts-modal">
        <div className="modal-header">
          <div>
            <h2>Central de alertas</h2>
            <p>{unreadKeys.length} alerta(s) não visualizado(s).</p>
          </div>
          <button onClick={onClose}><X size={18} /> Fechar</button>
        </div>

        <div className="module-actions">
          {!!alerts.length && <button onClick={onMarkAll}><CheckCircle size={17} /> Marcar todos como vistos</button>}
        </div>

        {!alerts.length && <p className="muted">Nenhum alerta no momento.</p>}

        <div className="alerts-list">
          {alerts.map((alert) => {
            const unread = unreadKeys.includes(alert.key);
            return (
              <div key={alert.key} className={unread ? "alert-item unread" : "alert-item"}>
                <div>
                  <strong>{alert.title}</strong>
                  <p>{alert.message}</p>
                </div>
                {unread ? (
                  <button onClick={() => onMarkSeen(alert.key)}>Marcar como visto</button>
                ) : (
                  <span className="seen-pill">Visto</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}


function MascotManager({ mascots, form, setForm, onAdd, onEdit, onCancelEdit, onToggle, onRemove, uploading, editingMascotId }) {
  async function handleFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const processedFile = form.removerFundo ? await removeWhiteBackgroundFromMascot(file, form.toleranciaFundo) : file;

      setForm({
        ...form,
        file: processedFile,
        preview: URL.createObjectURL(processedFile),
        native: "",
        nome: form.nome || file.name.replace(/\.(png|webp)$/i, ""),
      });
    } catch {
      setForm({
        ...form,
        file,
        preview: URL.createObjectURL(file),
        native: "",
        nome: form.nome || file.name.replace(/\.(png|webp)$/i, ""),
      });
    }

    event.target.value = "";
  }

  return (
    <ModuleCard title="Mascotes personalizados" subtitle="Gerencie os mascotes nativos e importados usados no Mundo dos Mascotes.">
      <div className="mascot-upload-grid">
        <div className="mascot-preview-box">
          {form.preview ? (
            <img src={form.preview} alt="Preview do mascote" />
          ) : form.native ? (
            <span className="native-preview"><NativeMascot type={form.native} /></span>
          ) : (
            <Gamepad2 size={44} />
          )}
          <small>Use PNG/WebP. Fundo branco é removido automaticamente quando a opção estiver ativa.</small>
        </div>

        <div className="mascot-form-grid">
          <input placeholder="Nome do mascote" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
            <option value="saltador">Saltador</option>
            <option value="voador">Voador</option>
            <option value="quicante">Quicante</option>
            <option value="eletrico">Elétrico</option>
            <option value="dragao">Dragão / Fogo</option>
          </select>
          <select value={form.tamanho} onChange={(e) => setForm({ ...form, tamanho: e.target.value })}>
            <option value="pequeno">Pequeno</option>
            <option value="medio">Médio</option>
            <option value="grande">Grande</option>
          </select>
          <select value={form.frequencia} onChange={(e) => setForm({ ...form, frequencia: e.target.value })}>
            <option value="baixa">Frequência baixa</option>
            <option value="normal">Frequência normal</option>
            <option value="alta">Frequência alta</option>
          </select>
          <select value={form.status || "A"} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="A">Ativo</option>
            <option value="X">Inativo</option>
          </select>
          <label className="mascot-check">
            <input type="checkbox" checked={form.removerFundo !== false} onChange={(e) => setForm({ ...form, removerFundo: e.target.checked })} />
            Remover fundo branco
          </label>
          <select value={form.toleranciaFundo || "media"} onChange={(e) => setForm({ ...form, toleranciaFundo: e.target.value })} disabled={form.removerFundo === false}>
            <option value="baixa">Tolerância baixa</option>
            <option value="media">Tolerância média</option>
            <option value="alta">Tolerância alta</option>
          </select>
          <label className="mascot-file-button">
            {editingMascotId ? "Trocar PNG/WebP" : "Escolher PNG/WebP"}
            <input type="file" accept="image/png,image/webp" onChange={handleFile} />
          </label>
          <button onClick={onAdd} disabled={uploading}>{uploading ? "Salvando..." : editingMascotId ? "Salvar mascote" : "+ Adicionar mascote"}</button>
          {editingMascotId && <button className="secondary-btn" onClick={onCancelEdit} disabled={uploading}>Cancelar edição</button>}
        </div>
      </div>

      <div className="mascot-list-title">
        <h4>Mascotes cadastrados</h4>
        <span>{mascots.length} no total</span>
      </div>

      <SimpleTable headers={["Mascote", "Origem", "Tipo", "Tamanho", "Status", "Ações"]}>
        {mascots.map((m) => (
          <tr key={m.id}>
            <td>
              <div className="mascot-table-cell">
                {m.imagemUrl ? <img src={m.imagemUrl} alt={m.nome} /> : <span className="native-table-preview"><NativeMascot type={m.native} /></span>}
                <strong>{m.nome}</strong>
              </div>
            </td>
            <td><span className={m.origem === "Nativo" ? "source-pill native" : "source-pill imported"}>{m.origem || "Importado"}</span></td>
            <td>{m.tipo}</td>
            <td>{m.tamanho}</td>
            <td><Status status={m.status === "A" ? "Ativo" : "Inativo"} /></td>
            <td className="right mascot-actions">
              <button className="icon-btn" title="Editar mascote" onClick={() => onEdit(m)}><Pencil size={17} /></button>
              <button onClick={() => onToggle(m.id)}>{m.status === "A" ? "Inativar" : "Ativar"}</button>
              <button className="icon-btn danger" onClick={() => onRemove(m.id)}><Trash2 size={18} /></button>
            </td>
          </tr>
        ))}
      </SimpleTable>
    </ModuleCard>
  );
}

function BackgroundAnimations({ mode, mascots = [] }) {
  const [sprites, setSprites] = useState([]);
  const frameRef = useRef(null);
  const lastRef = useRef(0);
  const platformsRef = useRef([]);

  const activeMascots = useMemo(() => {
    return (mascots || []).filter((m) => m.status === "A" && (m.imagemUrl || m.native));
  }, [mascots]);

  useEffect(() => {
    if (mode === "desativado") {
      setSprites([]);
      return;
    }

    const width = window.innerWidth || 1200;
    const height = window.innerHeight || 760;
    const isGamer = mode === "gamer";

    const baseList = activeMascots.map((m) => ({
      id: m.native ? m.id : `custom-${m.id}`,
      nome: m.nome,
      tipo: m.tipo || "saltador",
      native: m.native || "",
      src: m.imagemUrl || "",
      tamanho: m.tamanho || "medio",
      frequencia: m.frequencia || "normal",
      custom: !m.native,
    }));

    const visibleLimit = isGamer ? 6 : 4;
    const listToRender = baseList.slice(0, Math.min(baseList.length, visibleLimit));
    setSprites(listToRender.map((m, index) => createMascotSprite(m, index, width, height, mode)));
  }, [mode, activeMascots]);

  useEffect(() => {
    if (mode === "desativado" || !sprites.length) return;

    function refreshPlatforms() {
      const selectors = [
        ".sidebar",
        ".topbar",
        ".stat-card",
        ".dashboard-sales-management .module-card",
        ".version-footer",
      ];

      platformsRef.current = selectors
        .flatMap((selector) => Array.from(document.querySelectorAll(selector)))
        .map((element) => {
          const r = element.getBoundingClientRect();
          return { x: r.left, y: r.top, w: r.width, h: r.height };
        })
        .filter((r) => r.w > 60 && r.h > 26);
    }

    refreshPlatforms();
    window.addEventListener("resize", refreshPlatforms);
    const platformInterval = window.setInterval(refreshPlatforms, 900);

    function tick(time) {
      const width = window.innerWidth || 1200;
      const height = window.innerHeight || 760;
      const dt = Math.min(2.4, Math.max(0.35, (time - (lastRef.current || time)) / 16.67));
      lastRef.current = time;

      setSprites((prev) => prev.map((sprite) => stepMascotSprite(sprite, dt, width, height, platformsRef.current, mode)));
      frameRef.current = requestAnimationFrame(tick);
    }

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("resize", refreshPlatforms);
      window.clearInterval(platformInterval);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [mode, sprites.length]);

  if (mode === "desativado" || !sprites.length) return null;

  return (
    <div className={`mascot-world ${mode}`} aria-hidden="true">
      {sprites.map((sprite) => (
        <div
          key={sprite.id}
          className={`world-mascot ${sprite.native ? `native-${sprite.native}` : "custom-mascot"} motion-${sprite.tipo} ${sprite.facing < 0 ? "flip" : ""}`}
          style={{
            transform: `translate3d(${sprite.x}px, ${sprite.y}px, 0)`,
            width: sprite.size,
            height: sprite.size,
            opacity: sprite.opacity,
          }}
        >
          {sprite.src ? (
            <span className="custom-2-5d-shell">
              <span className="custom-2-5d-ground-shadow" />
              <span className="custom-2-5d-depth depth-back" />
              <img src={sprite.src} alt="" />
              <span className="custom-2-5d-depth depth-front" />
              <span className="custom-2-5d-highlight" />
              <span className="custom-2-5d-glow" />
            </span>
          ) : (
            <NativeMascot type={sprite.native} />
          )}
          {sprite.fireTimer > 0 && <span className="mascot-fire-breath" />}
          {sprite.sparkTimer > 0 && <span className="mascot-spark-field" />}
          {sprite.jumpDust > 0 && <span className="mascot-dust" />}
        </div>
      ))}
    </div>
  );
}

function createMascotSprite(mascot, index, width, height, mode = "discreto") {
  const sizeMap = { pequeno: 38, medio: 54, grande: 72 };
  const size = sizeMap[mascot.tamanho] || sizeMap.medio;
  const type = mascot.tipo || "saltador";
  const fromLeft = index % 2 === 0;
  const freqBoost = mascot.frequencia === "alta" ? 1.08 : mascot.frequencia === "baixa" ? 0.78 : 0.92;
  const speedBase = (mode === "gamer" ? 1.12 : 0.72) * freqBoost;
  const flyer = type === "voador" || type === "dragao" || type === "eletrico";
  const floor = height - 96 - size;
  const lane = 86 + (index * 88) % Math.max(160, height - 260);

  return {
    ...mascot,
    tipo: type,
    size,
    x: fromLeft ? Math.max(18, 42 + index * 28) : Math.max(18, width - size - 70 - index * 28),
    y: flyer ? Math.max(78, Math.min(height - 170, lane)) : Math.max(120, floor - ((index % 3) * 28)),
    vx: fromLeft ? speedBase : -speedBase,
    vy: flyer ? (index % 2 ? 0.12 : -0.12) : 0,
    grounded: false,
    facing: fromLeft ? 1 : -1,
    opacity: 0.94,
    jumpCooldown: 110 + index * 34,
    avoidTimer: 0,
    fireTimer: 0,
    sparkTimer: 0,
    jumpDust: 0,
    life: Math.random() * 80,
    restTimer: 30 + index * 12,
  };
}

function resetMascot(sprite, width, height) {
  const flyer = sprite.tipo === "voador" || sprite.tipo === "dragao" || sprite.tipo === "eletrico";
  const floor = height - 96 - sprite.size;

  return {
    ...sprite,
    x: Math.max(24, Math.min(width - sprite.size - 24, sprite.x || 60)),
    y: flyer ? Math.max(76, Math.min(height - 170, sprite.y || 110)) : Math.max(120, floor),
    vx: sprite.vx || 0.7,
    vy: flyer ? 0 : 0,
    fireTimer: 0,
    sparkTimer: 0,
    jumpDust: 0,
    avoidTimer: 0,
    life: 0,
  };
}

function intersectsSprite(sprite, p) {
  return sprite.x + sprite.size > p.x && sprite.x < p.x + p.w && sprite.y + sprite.size > p.y && sprite.y < p.y + p.h;
}

function stepMascotSprite(sprite, dt, width, height, platforms, mode) {
  let next = { ...sprite };
  const isFlyer = next.tipo === "voador" || next.tipo === "dragao" || next.tipo === "eletrico";
  const isBouncer = next.tipo === "quicante";
  const floor = height - 96 - next.size;
  const leftBound = 12;
  const rightBound = Math.max(12, width - next.size - 12);
  const topBound = 58;
  const speedMultiplier = mode === "gamer" ? 1.04 : 0.88;
  const gravity = isFlyer ? 0.006 : 0.18;
  const maxVx = mode === "gamer" ? 1.35 : 0.95;
  const maxVy = isFlyer ? 1.55 : 6.5;

  next.life += dt;
  next.avoidTimer = Math.max(0, next.avoidTimer - dt);
  next.jumpCooldown = Math.max(0, next.jumpCooldown - dt);
  next.restTimer = Math.max(0, (next.restTimer || 0) - dt);
  next.fireTimer = Math.max(0, next.fireTimer - dt);
  next.sparkTimer = Math.max(0, next.sparkTimer - dt);
  next.jumpDust = Math.max(0, next.jumpDust - dt);

  if (Math.abs(next.vx) > maxVx) next.vx = Math.sign(next.vx) * maxVx;
  if (Math.abs(next.vy) > maxVy) next.vy = Math.sign(next.vy) * maxVy;

  next.facing = next.vx >= 0 ? 1 : -1;

  if (isFlyer) {
    const wave = Math.sin((next.life + next.size) / 28) * (next.tipo === "eletrico" ? 0.62 : 0.38);
    next.x += next.vx * speedMultiplier * dt;
    next.y += (next.vy + wave) * dt;
    next.vy += Math.sin(next.life / 42) * 0.01;

    for (const p of platforms) {
      if (!intersectsSprite(next, p)) continue;

      const spriteCenterX = next.x + next.size / 2;
      const spriteCenterY = next.y + next.size / 2;
      const platformCenterX = p.x + p.w / 2;
      const platformCenterY = p.y + p.h / 2;

      const pushX = spriteCenterX < platformCenterX ? -0.35 : 0.35;
      const pushY = spriteCenterY < platformCenterY ? -0.42 : 0.42;

      next.vx += pushX;
      next.vy += pushY;
      next.x += pushX * 14;
      next.y += pushY * 14;
      next.avoidTimer = 36;
    }

    if (next.x <= leftBound) {
      next.x = leftBound;
      next.vx = Math.abs(next.vx || 0.65);
    }

    if (next.x >= rightBound) {
      next.x = rightBound;
      next.vx = -Math.abs(next.vx || 0.65);
    }

    if (next.y <= topBound) {
      next.y = topBound;
      next.vy = Math.abs(next.vy || 0.25);
    }

    if (next.y >= floor) {
      next.y = floor;
      next.vy = -Math.abs(next.vy || 0.45);
    }

    if (next.tipo === "dragao" && next.life % 180 < 2.0) next.fireTimer = 70;
    if (next.tipo === "eletrico" && next.life % 120 < 1.8) next.sparkTimer = 42;
  } else {
    const prev = { x: next.x, y: next.y };
    next.x += next.vx * speedMultiplier * dt;
    next.y += next.vy * dt;
    next.vy += gravity * dt;
    next.grounded = false;

    for (const p of platforms) {
      if (!intersectsSprite(next, p)) continue;

      const prevBottom = prev.y + next.size;
      const nextBottom = next.y + next.size;
      const horizontalOverlap = next.x + next.size > p.x + 8 && next.x < p.x + p.w - 8;

      if (horizontalOverlap && prevBottom <= p.y + 14 && nextBottom >= p.y && next.vy >= 0) {
        next.y = p.y - next.size - 1;
        next.vy = 0;
        next.grounded = true;

        if (next.jumpCooldown <= 0 && (isBouncer || next.tipo === "saltador")) {
          next.vy = isBouncer ? -4.8 : -3.9;
          next.jumpCooldown = isBouncer ? 92 : 150;
          next.jumpDust = 12;
        }

        continue;
      }

      if (next.avoidTimer <= 0) {
        const fromLeft = prev.x + next.size <= p.x + 10;
        const fromRight = prev.x >= p.x + p.w - 10;

        if (fromLeft) next.x = p.x - next.size - 7;
        else if (fromRight) next.x = p.x + p.w + 7;
        else next.y = p.y - next.size - 7;

        next.vx = -next.vx * 0.86;
        next.vy = isBouncer ? -4.9 : -3.8;
        next.jumpDust = 14;
        next.avoidTimer = 48;
      }
    }

    if (next.x <= leftBound) {
      next.x = leftBound;
      next.vx = Math.abs(next.vx || 0.55);
    }

    if (next.x >= rightBound) {
      next.x = rightBound;
      next.vx = -Math.abs(next.vx || 0.55);
    }

    if (next.y >= floor) {
      next.y = floor;
      next.grounded = true;

      if (isBouncer && next.jumpCooldown <= 0) {
        next.vy = -4.8;
        next.jumpCooldown = 88;
        next.jumpDust = 10;
      } else if (next.tipo === "saltador" && next.jumpCooldown <= 0) {
        next.vy = -3.8;
        next.jumpCooldown = 145;
        next.jumpDust = 10;
      } else {
        next.vy = 0;
      }
    }

    if (next.y <= topBound) {
      next.y = topBound;
      next.vy = Math.abs(next.vy) * 0.4;
    }
  }

  if (!Number.isFinite(next.x) || !Number.isFinite(next.y) || next.y > height + 120) {
    next = resetMascot(next, width, height);
  }

  return next;
}

function NativeMascot({ type }) {
  if (type === "runner") return <><i className="native-runner-body" /><i className="native-runner-eye" /><i className="native-runner-feet" /></>;
  if (type === "orb") return <><i className="native-orb-core" /><i className="native-orb-bolt one" /><i className="native-orb-bolt two" /></>;
  if (type === "dragon") return <><i className="native-dragon-wing" /><i className="native-dragon-body" /><i className="native-dragon-eye" /></>;
  if (type === "cart") return <><i className="native-cart-body" /><i className="native-cart-label" /></>;
  if (type === "coin") return <><i className="native-coin-body" /><i className="native-coin-shine" /></>;
  if (type === "star") return <><i className="native-star-body" /><i className="native-star-shine" /></>;
  return <i className="native-runner-body" />;
}

function MonthlyHistory({ data }) {
  if (!data.length) return <p className="muted">Nenhum histórico mensal disponível ainda.</p>;

  return (
    <SimpleTable headers={["Mês", "Capital", "Faturamento", "Lucro Real", "ROI", "Vendidos"]}>
      {data.map((row) => (
        <tr key={row.key}>
          <td>{row.label.charAt(0).toUpperCase() + row.label.slice(1)}</td>
          <td>{currency(row.capital)}</td>
          <td className="green">{currency(row.faturamento)}</td>
          <td className="green strong">{currency(row.lucroReal)}</td>
          <td>{row.roi.toFixed(2).replace(".", ",")}%</td>
          <td>{row.vendidos}</td>
        </tr>
      ))}
    </SimpleTable>
  );
}

function CalendarModal({ events, onClose }) {
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(dateKey(new Date()));

  const eventsByDate = useMemo(() => {
    const map = new Map();
    events.forEach((event) => map.set(event.date, event));
    return map;
  }, [events]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = firstDay.getDay();
  const days = [];

  for (let i = 0; i < startOffset; i++) days.push(null);
  for (let day = 1; day <= lastDay.getDate(); day++) days.push(new Date(year, month, day));

  const monthLabel = viewDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const selectedEvent = eventsByDate.get(selectedDate);

  function changeMonth(delta) {
    setViewDate(new Date(year, month + delta, 1));
  }

  return (
    <div className="modal-backdrop">
      <div className="version-modal calendar-modal visual-calendar-modal">
        <div className="modal-header">
          <div>
            <h2>Calendário de movimentações</h2>
            <p>Compras em vermelho e vendas em verde.</p>
          </div>
          <button onClick={onClose}><X size={18} /> Fechar</button>
        </div>

        <div className="calendar-toolbar">
          <button type="button" onClick={() => changeMonth(-1)}>‹</button>
          <strong>{monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}</strong>
          <button type="button" onClick={() => changeMonth(1)}>›</button>
        </div>

        <div className="calendar-legend">
          <span><i className="legend-dot purchase" /> Compra / despesa</span>
          <span><i className="legend-dot sale" /> Venda / receita</span>
        </div>

        <div className="calendar-grid visual-calendar-grid">
          {["D", "S", "T", "Q", "Q", "S", "S"].map((dayName, index) => (
            <div key={`${dayName}-${index}`} className="calendar-weekday">{dayName}</div>
          ))}

          {days.map((day, index) => {
            if (!day) return <div key={`empty-${index}`} className="calendar-cell empty" />;
            const key = dateKey(day);
            const event = eventsByDate.get(key);
            const hasPurchase = !!event?.compras?.length;
            const hasSale = !!event?.vendas?.length;
            const isSelected = selectedDate === key;
            const classes = ["calendar-cell"];
            if (hasPurchase) classes.push("has-purchase");
            if (hasSale) classes.push("has-sale");
            if (isSelected) classes.push("selected");

            return (
              <button key={key} type="button" className={classes.join(" ")} onClick={() => setSelectedDate(key)}>
                <strong>{day.getDate()}</strong>
                <span className="calendar-markers">
                  {hasPurchase && <i className="purchase" />}
                  {hasSale && <i className="sale" />}
                </span>
              </button>
            );
          })}
        </div>

        <div className="calendar-details">
          <h3>{selectedDate ? formatDateBR(selectedDate) : "Selecione um dia"}</h3>
          {!selectedEvent && <p className="muted">Nenhuma compra ou venda registrada neste dia.</p>}
          {selectedEvent?.compras?.map((item, index) => (
            <p key={`compra-${index}`} className="calendar-detail purchase"><strong>Compra:</strong> {item.nome} — {currency(item.valor)}</p>
          ))}
          {selectedEvent?.vendas?.map((item, index) => (
            <p key={`venda-${index}`} className="calendar-detail sale"><strong>Venda:</strong> {item.nome} — {currency(item.valor)}</p>
          ))}
        </div>
      </div>
    </div>
  );
}

function CalendarEventList({ events }) {
  if (!events.length) return <p className="muted">Nenhuma compra ou venda registrada ainda.</p>;
  return <div className="calendar-event-list">{events.map((day) => <div key={day.date} className="calendar-day"><h3>{formatDateBR(day.date)}</h3>{day.compras.map((item, index) => <p key={`c-${index}`}><strong>Compra:</strong> {item.nome} — {currency(item.valor)}</p>)}{day.vendas.map((item, index) => <p key={`v-${index}`}><strong>Venda:</strong> {item.nome} — {currency(item.valor)}</p>)}</div>)}</div>;
}

function VersionModal({ onClose }) {
  return (
    <div className="modal-backdrop">
      <div className="version-modal">
        <div className="modal-header">
          <div>
            <h2>Novidades da versão {APP_VERSION}</h2>
            <p>Resumo da atualização 4.0.</p>
          </div>
          <button onClick={onClose}><X size={18} /> Fechar</button>
        </div>
        <ul>
          <li>Controle de estoque atual e estoque mínimo em Custos Extras.</li>
          <li>Consumo automático de estoque ao aplicar custo extra em produto.</li>
          <li>Devolução automática ao remover custo extra do produto.</li>
          <li>Bloqueio de custo extra sem estoque disponível.</li>
          <li>Sino de alertas com contador e central de alertas.</li>
          <li>Fechamento mensal visual com Dashboard focado no mês vigente.</li>
          <li>Histórico mensal em Relatórios.</li>
          <li>Dashboard mais limpo com Gerenciamento de Vendas centralizado.</li>
          <li>Animações de fundo com modos Desativado, Discreto e Gamer.</li>
          <li>Correção dos cálculos mensais para vendas legadas sem data de venda.</li>
          <li>Mundo dos Mascotes com física leve, gravidade e colisão com cards/menus.</li>
          <li>Mascotes nativos com comportamento próprio: saltador, elétrico, quicante e dragão com fogo.</li>
          <li>Upload de mascotes personalizados em Manutenção.</li>
          <li>PNG/WebP importado passa a ser usado no Mundo dos Mascotes.</li>
          <li>Mascotes personalizados agora entram na física do mundo, com movimento conforme o tipo escolhido.</li>
          <li>Corrigido mascote importado parado sobre os cards.</li>
          <li>Mascotes importados com efeito 2.5D automático.</li>
          <li>Sombra dinâmica, brilho, profundidade, inclinação e squash/stretch nos PNGs importados.</li>
          <li>Todos os mascotes nativos agora aparecem em Manutenção para edição/ativação.</li>
          <li>Adicionado lápis para editar mascotes já cadastrados.</li>
          <li>Remoção automática de fundo branco no upload de PNG/WebP.</li>
          <li>Gerenciamento de Vendas ampliado e responsivo.</li>
          <li>Lápis nas vendas concluídas para editar venda real, data e informações do produto vendido.</li>
          <li>Física dos mascotes estabilizada: movimento mais lento, gravidade mais natural e sem sumir pelas laterais.</li>
          <li>Modais de alertas e cadastro corrigidos para abrir corretamente sobre o sistema.</li>
          <li>Tipos de movimento: Saltador, Voador, Quicante, Elétrico e Dragão/Fogo.</li>
        </ul>
      </div>
    </div>
  );
}

function FormSection({ title, children }) { return <div className="form-section"><h3>{title}</h3>{children}</div>; }

function ImagesGrid({ images = [], removeImage, setExpandedImage }) {
  const emptySlots = Math.max(0, 6 - images.length);
  return <div className="images-grid">{images.map((image, index) => <div key={index} className="image-slot filled"><button type="button" onClick={() => setExpandedImage(imageSrc(image))}><img src={imageSrc(image)} alt={`Produto ${index + 1}`} /></button><button type="button" className="delete-image" onClick={() => removeImage(index)}><Trash2 size={14} /></button></div>)}{Array.from({ length: emptySlots }).map((_, index) => <div key={`empty-${index}`} className="image-slot empty"><ImagePlus size={22} /></div>)}</div>;
}

function ProductsTable({ products, updateProduct, sellProduct, editProduct, removeProduct, setExpandedImage, permissions }) {
  return (
    <div className="table-wrap">
      <table className="products-table">
        <thead><tr><th>Produto</th><th>Estoque</th><th>Compra</th><th>Custos extras</th><th>Custo final</th><th>Venda esperada</th><th>Lucro esperado</th><th>Venda real</th><th>Lucro real</th><th>Status</th><th></th></tr></thead>
        <tbody>{products.map((product) => { const calc = productMath(product); return <tr key={product.id} className={Number(product.quantidade || 0) <= Number(product.estoqueMinimo || 0) ? "low-stock-row" : ""}><td><div className="product-cell"><button className="thumb" onClick={() => setExpandedImage(imageSrc(product.imagens?.[0]))}>{product.imagens?.[0] ? <img src={imageSrc(product.imagens[0])} alt={product.nome} /> : <ImagePlus />}</button><div><input value={product.nome} onChange={(e) => updateProduct(product.id, "nome", e.target.value)} disabled={!permissions.canEdit} /><input value={product.sku} onChange={(e) => updateProduct(product.id, "sku", e.target.value)} disabled={!permissions.canEdit} /></div></div></td><td><div className="stock-grid"><input type="number" value={product.quantidade} onChange={(e) => updateProduct(product.id, "quantidade", e.target.value)} disabled={!permissions.canEdit} /><input type="number" value={product.estoqueMinimo} onChange={(e) => updateProduct(product.id, "estoqueMinimo", e.target.value)} disabled={!permissions.canEdit} /></div></td><td><input type="number" className="wide-money-input" value={product.compra} onChange={(e) => updateProduct(product.id, "compra", e.target.value)} disabled={!permissions.canEdit} /></td><td>{currency(calc.custosExtras)}</td><td className="strong">{currency(calc.custoFinal)}</td><td><input type="number" className="wide-money-input" value={product.vendaEsperada} onChange={(e) => updateProduct(product.id, "vendaEsperada", e.target.value)} disabled={!permissions.canEdit} /></td><td className="green strong">{currency(calc.lucroEsperado)}</td><td><input type="number" className="wide-money-input" value={product.vendaReal} onChange={(e) => updateProduct(product.id, "vendaReal", e.target.value)} placeholder="Após vender" disabled={!permissions.canEdit} /></td><td className="green strong">{product.status === "Vendido" ? currency(calc.lucroReal) : "-"}</td><td><Status status={product.status} /></td><td><div className="row-actions">{permissions.canSell && <button className="sold-btn" onClick={() => sellProduct(product.id)}>Vendido</button>}{permissions.canEdit && <button className="icon-btn" onClick={() => editProduct(product)}><Pencil size={18} /></button>}{permissions.canDelete && <button className="icon-btn danger" onClick={() => removeProduct(product.id)}><Trash2 size={18} /></button>}</div></td></tr>; })}</tbody>
      </table>
    </div>
  );
}

function ModuleCard({ title, subtitle, children }) { return <div className="module-card"><div className="module-header"><h3><Package size={20} /> {title}</h3><p>{subtitle}</p></div>{children}</div>; }
function SimpleTable({ headers, children }) { return <div className="table-wrap"><table className="simple-table"><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{children}</tbody></table></div>; }
function Stat({ title, value, subtitle, icon: Icon, color }) { return <div className={`stat-card ${color}`}><div><p>{title}</p><strong>{value}</strong><small>{subtitle}</small></div><span><Icon size={22} /></span></div>; }
function Status({ status }) { if (status === "Vendido") return <span className="status sold">Vendido</span>; if (status === "Reservado") return <span className="status reserved">Reservado</span>; return <span className="status stock">Em estoque</span>; }
function Line({ label, value, good, bad }) { return <div className="line"><span>{label}</span><strong className={good ? "green" : bad ? "red" : ""}>{value}</strong></div>; }
function FinancialSummary({ summary }) { return <ModuleCard title="Resumo Financeiro" subtitle="Resultado operacional"><Line label="Faturamento" value={currency(summary.receitaReal)} good /><Line label="Custo dos vendidos" value={`-${currency(summary.custoVendidos)}`} bad /><Line label="Lucro bruto" value={currency(summary.lucroReal)} good /><Line label="Lucro esperado" value={currency(summary.lucroEsperado)} good /></ModuleCard>; }
function CostDistribution({ costs, summary }) { return <ModuleCard title="Distribuição dos custos" subtitle="Composição do capital"><div className="cost-bars">{costs.map(([name, value, cls]) => { const percent = summary.capitalInvestido ? (value / summary.capitalInvestido) * 100 : 0; return <div key={name}><div className="bar-label"><span>{name}</span><strong>{currency(value)} ({percent.toFixed(1)}%)</strong></div><div className="bar-bg"><div className={cls} style={{ width: `${Math.min(100, percent)}%` }} /></div></div>; })}</div></ModuleCard>; }
function RecentSales({ products }) { return <ModuleCard title="Vendas recentes" subtitle="Últimas vendas"><div className="recent-list">{products.map((p) => { const calc = productMath(p); return <div key={p.id} className="recent-item"><div><strong>{p.nome}</strong><small>{formatDateBR(p.dataVenda)}</small></div><span>{currency(calc.lucroReal)}</span></div>; })}</div></ModuleCard>; }
function MiniReport({ title, value, desc }) { return <div className="mini-report"><p>{title}</p><strong>{value}</strong><small>{desc}</small></div>; }
function FinanceCharts({ summary }) { const max = Math.max(summary.receitaReal, summary.valorEstoque, summary.lucroEsperado, summary.lucroReal, 1); const items = [["Receita", summary.receitaReal, "bar-green"], ["Estoque", summary.valorEstoque, "bar-white"], ["Lucro esperado", summary.lucroEsperado, "bar-yellow"], ["Lucro real", summary.lucroReal, "bar-purple"]]; return <div className="finance-chart">{items.map(([label, value, cls]) => <div key={label}><div className="bar-label"><span>{label}</span><strong>{currency(value)}</strong></div><div className="bar-bg"><div className={cls} style={{ width: `${Math.max(4, (value / max) * 100)}%` }} /></div></div>)}</div>; }
function LowStockList({ products }) { if (!products.length) return <p className="muted">Nenhum produto abaixo ou igual ao estoque mínimo.</p>; return <div className="low-stock-list">{products.map((p) => <div key={p.id} className="low-stock-item"><strong>{p.nome}</strong><span>Qtd: {p.quantidade} / Mínimo: {p.estoqueMinimo}</span></div>)}</div>; }
function NoPermission() { return <ModuleCard title="Acesso restrito" subtitle="Seu perfil não possui permissão para esta rotina."><p className="muted">Solicite acesso a um administrador.</p></ModuleCard>; }
