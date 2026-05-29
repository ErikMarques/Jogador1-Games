import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  BarChart3,
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
  Shield,
  ShoppingCart,
  Trash2,
  TrendingUp,
  Upload,
  Users,
  Wallet,
  Wrench,
  X,
} from "lucide-react";

const APP_VERSION = "3.0";
const STORAGE_BUCKET = "produto-imagens";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const emptyProduct = {
  nome: "",
  sku: "",
  compra: "",
  chip: "",
  frete: "",
  manutencao: "",
  outros: "",
  vendaEsperada: "",
  vendaReal: "",
  estoqueMinimo: 1,
  quantidade: 1,
  imagens: [],
};

const permissionsByRole = {
  administrador: {
    canCreate: true,
    canEdit: true,
    canDelete: true,
    canSell: true,
    canFinancial: true,
    canUsers: true,
    canBackup: true,
  },
  funcionario: {
    canCreate: true,
    canEdit: true,
    canDelete: false,
    canSell: true,
    canFinancial: false,
    canUsers: false,
    canBackup: true,
  },
  visualizacao: {
    canCreate: false,
    canEdit: false,
    canDelete: false,
    canSell: false,
    canFinancial: false,
    canUsers: false,
    canBackup: false,
  },
};

function currency(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function productMath(p) {
  const custoFinal =
    Number(p.compra || 0) +
    Number(p.chip || 0) +
    Number(p.frete || 0) +
    Number(p.manutencao || 0) +
    Number(p.outros || 0);

  const lucroEsperado = Number(p.vendaEsperada || 0) - custoFinal;
  const lucroReal = p.status === "Vendido" ? Number(p.vendaReal || 0) - custoFinal : 0;

  return { custoFinal, lucroEsperado, lucroReal };
}

function placeholderImage(text, color = "#dc2626") {
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="300" height="220" viewBox="0 0 300 220">
    <rect width="300" height="220" rx="24" fill="#101014"/>
    <rect x="18" y="18" width="264" height="184" rx="20" fill="${color}" opacity="0.18"/>
    <circle cx="150" cy="82" r="42" fill="${color}" opacity="0.8"/>
    <rect x="86" y="132" width="128" height="18" rx="9" fill="#ffffff" opacity="0.9"/>
    <rect x="108" y="160" width="84" height="10" rx="5" fill="#ffffff" opacity="0.55"/>
    <text x="150" y="207" font-family="Arial" font-size="16" font-weight="700" text-anchor="middle" fill="#ffffff">${text}</text>
  </svg>`;
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
  const [inactiveProducts, setInactiveProducts] = useState([]);
  const [newProduct, setNewProduct] = useState(emptyProduct);
  const [newProductOpen, setNewProductOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [expandedImage, setExpandedImage] = useState(null);
  const [versionOpen, setVersionOpen] = useState(false);
  const [syncMessage, setSyncMessage] = useState("Aguardando conexão com Supabase...");
  const [syncing, setSyncing] = useState(false);

  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState({ perfil: "administrador", nome: "Administrador" });
  const [profiles, setProfiles] = useState([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState("");

  const [extraCost, setExtraCost] = useState({ descricao: "", valor: "", data: "" });
  const [extraCosts, setExtraCosts] = useState([]);

  const permissions = permissionsByRole[profile?.perfil || "visualizacao"] || permissionsByRole.visualizacao;

  useEffect(() => {
    if (!supabase) {
      setLoadingAuth(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoadingAuth(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      loadUserProfile();
      loadProducts();
      loadExtraCosts();
      loadProfiles();
    }
  }, [user]);

  async function signIn() {
    if (!supabase) return setAuthError("Supabase não configurado.");
    setAuthError("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) setAuthError(error.message);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
  }

  async function loadUserProfile() {
    if (!supabase || !user) return;

    const { data } = await supabase
      .from("usuarios_perfis")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (data) {
      setProfile(data);
      return;
    }

    const fallback = {
      user_id: user.id,
      email: user.email,
      nome: user.email,
      perfil: "administrador",
      status: "A",
    };

    await supabase.from("usuarios_perfis").insert(fallback);
    setProfile(fallback);
  }

  async function loadProfiles() {
    if (!supabase) return;
    const { data } = await supabase
      .from("usuarios_perfis")
      .select("*")
      .order("criado_em", { ascending: false });

    if (data) setProfiles(data);
  }

  async function loadExtraCosts() {
    if (!supabase) return;

    const { data } = await supabase
      .from("custos_extras")
      .select("*")
      .order("criado_em", { ascending: false });

    if (data) {
      setExtraCosts(
        data.map((c) => ({
          id: c.id,
          descricao: c.descricao,
          valor: Number(c.valor || 0),
          data: c.criado_em ? new Date(c.criado_em).toLocaleDateString("pt-BR") : "",
        }))
      );
    }
  }

  async function loadProducts() {
    if (!supabase) {
      setSyncMessage("Configure as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.");
      return;
    }

    setSyncing(true);

    const { data, error } = await supabase
      .from("produtos")
      .select("*, produto_imagens(id, imagem_url)")
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
      estoqueMinimo: Number(p.estoque_minimo || 1),
      quantidade: Number(p.quantidade || 1),
      dataVenda: "",
      imagens: (p.produto_imagens || []).map((img) => img.imagem_url),
    }));

    setProducts(converted.filter((p) => p.statusRegistro !== "X"));
    setInactiveProducts(converted.filter((p) => p.statusRegistro === "X"));
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

    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, image.file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) throw error;

    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  }

  async function uploadImagesAndSaveRows(productId, images) {
    const urls = [];

    for (const image of images.slice(0, 6)) {
      const url = await uploadImageFile(productId, image);
      if (url) urls.push(url);
    }

    if (urls.length) {
      await supabase.from("produto_imagens").insert(
        urls.map((url) => ({
          produto_id: productId,
          imagem_url: url,
        }))
      );
    }

    return urls;
  }

  async function deleteImageFromStorageIfNeeded(url) {
    if (!supabase || !isStorageUrl(url)) return;
    const path = storagePathFromPublicUrl(url);
    if (path) await supabase.storage.from(STORAGE_BUCKET).remove([path]);
  }

  const summary = useMemo(() => {
    return products.reduce(
      (acc, p) => {
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
        acc.chip += Number(p.chip || 0);
        acc.frete += Number(p.frete || 0);
        acc.manutencao += Number(p.manutencao || 0);
        acc.outros += Number(p.outros || 0);
        return acc;
      },
      {
        capitalInvestido: 0,
        lucroEsperado: 0,
        valorEstoque: 0,
        produtosEstoque: 0,
        produtosVendidos: 0,
        receitaReal: 0,
        lucroReal: 0,
        custoVendidos: 0,
        compra: 0,
        chip: 0,
        frete: 0,
        manutencao: 0,
        outros: 0,
      }
    );
  }, [products]);

  const totalExtraCosts = extraCosts.reduce((acc, item) => acc + Number(item.valor || 0), 0);
  const lowStockProducts = products.filter((p) => Number(p.quantidade || 0) <= Number(p.estoqueMinimo || 0));

  const costDistribution = [
    ["Compras", summary.compra, "bar-white"],
    ["Chips / Desbloqueios", summary.chip, "bar-red"],
    ["Frete", summary.frete, "bar-yellow"],
    ["Manutenção", summary.manutencao, "bar-green"],
    ["Outros", summary.outros, "bar-purple"],
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

  function readImages(event, callback) {
    const files = Array.from(event.target.files || []);
    const selected = files.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
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
      sku: newProduct.sku || `SKU-${products.length + 1}`,
      compra: Number(newProduct.compra || 0),
      chip: Number(newProduct.chip || 0),
      frete: Number(newProduct.frete || 0),
      manutencao: Number(newProduct.manutencao || 0),
      outros: Number(newProduct.outros || 0),
      vendaEsperada: Number(newProduct.vendaEsperada || 0),
      vendaReal: "",
      status: "Em estoque",
      statusRegistro: "A",
      estoqueMinimo: Number(newProduct.estoqueMinimo || 1),
      quantidade: Number(newProduct.quantidade || 1),
      dataVenda: "",
      imagens: newProduct.imagens.length ? newProduct.imagens : [placeholderImage("NOVO")],
    };

    if (!supabase) return;

    const calc = productMath(product);
    setSyncing(true);
    setSyncMessage("Salvando produto e imagens no Supabase...");

    const { data, error } = await supabase
      .from("produtos")
      .insert({
        nome: product.nome,
        sku: product.sku,
        preco_compra: product.compra,
        chip: product.chip,
        frete: product.frete,
        manutencao: product.manutencao,
        outros: product.outros,
        custo_final: calc.custoFinal,
        venda_esperada: product.vendaEsperada,
        venda_real: null,
        lucro_esperado: calc.lucroEsperado,
        lucro_real: null,
        status: product.status,
        status_registro: "A",
        estoque_minimo: product.estoqueMinimo,
        quantidade: product.quantidade,
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
      setProducts((prev) => [{ ...product, id: data.id, imagens: urls }, ...prev]);
      setNewProduct(emptyProduct);
      setNewProductOpen(false);
      setSyncMessage("Produto salvo com imagens reais no Supabase Storage.");
    } catch (error) {
      setSyncMessage(`Produto salvo, mas houve erro no upload: ${error.message}`);
    }

    setSyncing(false);
  }

  function updateProduct(id, field, value) {
    const textFields = ["nome", "sku", "status", "dataVenda"];
    setProducts((prev) =>
      prev.map((product) =>
        product.id === id
          ? { ...product, [field]: textFields.includes(field) ? value : value === "" ? "" : Number(value) }
          : product
      )
    );
  }

  async function sellProduct(id) {
    if (!permissions.canSell) return alert("Seu perfil não permite marcar venda.");
    const target = products.find((p) => p.id === id);
    if (!target) return;

    const next = {
      ...target,
      status: "Vendido",
      vendaReal: target.vendaReal || target.vendaEsperada,
      dataVenda: target.dataVenda || "Hoje",
    };
    const calc = productMath(next);

    setProducts((prev) => prev.map((p) => (p.id === id ? next : p)));

    if (supabase) {
      await supabase
        .from("produtos")
        .update({
          status: "Vendido",
          venda_real: Number(next.vendaReal || 0),
          lucro_real: calc.lucroReal,
        })
        .eq("id", id);
    }
  }

  async function saveEdit() {
    if (!permissions.canEdit) return alert("Seu perfil não permite editar produtos.");
    if (!editingProduct || !supabase) return;

    setSyncing(true);
    setSyncMessage("Salvando alterações no Supabase...");

    const calc = productMath(editingProduct);

    const { error } = await supabase
      .from("produtos")
      .update({
        nome: editingProduct.nome,
        sku: editingProduct.sku,
        preco_compra: Number(editingProduct.compra || 0),
        chip: Number(editingProduct.chip || 0),
        frete: Number(editingProduct.frete || 0),
        manutencao: Number(editingProduct.manutencao || 0),
        outros: Number(editingProduct.outros || 0),
        custo_final: calc.custoFinal,
        venda_esperada: Number(editingProduct.vendaEsperada || 0),
        venda_real: editingProduct.vendaReal === "" ? null : Number(editingProduct.vendaReal || 0),
        lucro_esperado: calc.lucroEsperado,
        lucro_real: editingProduct.status === "Vendido" ? calc.lucroReal : null,
        status: editingProduct.status || "Em estoque",
        estoque_minimo: Number(editingProduct.estoqueMinimo || 1),
        quantidade: Number(editingProduct.quantidade || 1),
      })
      .eq("id", editingProduct.id);

    if (error) {
      setSyncMessage(`Erro ao editar: ${error.message}`);
      setSyncing(false);
      return;
    }

    const { data: oldRows } = await supabase
      .from("produto_imagens")
      .select("imagem_url")
      .eq("produto_id", editingProduct.id);

    const oldUrls = (oldRows || []).map((row) => row.imagem_url);
    const keptExistingUrls = (editingProduct.imagens || []).filter((img) => typeof img === "string");
    const removedUrls = oldUrls.filter((url) => !keptExistingUrls.includes(url));

    for (const url of removedUrls) await deleteImageFromStorageIfNeeded(url);

    await supabase.from("produto_imagens").delete().eq("produto_id", editingProduct.id);
    const finalUrls = await uploadImagesAndSaveRows(editingProduct.id, editingProduct.imagens || []);

    setProducts((prev) =>
      prev.map((item) =>
        item.id === editingProduct.id ? { ...editingProduct, imagens: finalUrls } : item
      )
    );

    setEditingProduct(null);
    setSyncMessage("Produto editado com sucesso.");
    setSyncing(false);
  }

  async function removeProduct(id) {
    if (!permissions.canDelete) return alert("Seu perfil não permite excluir produtos.");

    const target = products.find((p) => p.id === id);
    if (!target) return;

    const confirmDelete = window.confirm("Deseja inativar este produto? O registro será mantido no banco com status X.");
    if (!confirmDelete) return;

    if (supabase) {
      const { error } = await supabase
        .from("produtos")
        .update({ status_registro: "X" })
        .eq("id", id);

      if (error) return alert(`Erro ao inativar produto: ${error.message}`);
    }

    setProducts((prev) => prev.filter((item) => item.id !== id));
    setInactiveProducts((prev) => [{ ...target, statusRegistro: "X" }, ...prev]);
  }

  async function restoreProduct(id) {
    const target = inactiveProducts.find((p) => p.id === id);
    if (!target) return;

    if (supabase) {
      await supabase.from("produtos").update({ status_registro: "A" }).eq("id", id);
    }

    setInactiveProducts((prev) => prev.filter((item) => item.id !== id));
    setProducts((prev) => [{ ...target, statusRegistro: "A" }, ...prev]);
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
        })
        .select()
        .single();

      if (data) {
        setExtraCosts((prev) => [
          {
            id: data.id,
            descricao: data.descricao,
            valor: Number(data.valor || 0),
            data: data.criado_em ? new Date(data.criado_em).toLocaleDateString("pt-BR") : "Hoje",
          },
          ...prev,
        ]);
      }
    }

    setExtraCost({ descricao: "", valor: "", data: "" });
  }

  function exportBackup() {
    if (!permissions.canBackup) return alert("Seu perfil não permite backup.");

    const backup = {
      gerado_em: new Date().toISOString(),
      versao: APP_VERSION,
      produtos_ativos: products,
      produtos_inativos: inactiveProducts,
      custos_extras: extraCosts,
      resumo: summary,
    };

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
          <div className="module-actions">
            {permissions.canCreate && <button onClick={() => setNewProductOpen(true)}><Plus size={17} /> Cadastrar Produto</button>}
          </div>
          <ProductsTable
            products={products}
            updateProduct={updateProduct}
            sellProduct={sellProduct}
            editProduct={setEditingProduct}
            removeProduct={removeProduct}
            setExpandedImage={setExpandedImage}
            permissions={permissions}
          />
        </ModuleCard>
      );
    }

    if (activeMenu === "Vendas") {
      const sold = products.filter((p) => p.status === "Vendido");
      return (
        <ModuleCard title="Vendas" subtitle="Produtos vendidos, valor realizado e lucro real.">
          <SimpleTable headers={["Produto", "Data", "Venda real", "Custo", "Lucro real"]}>
            {sold.map((p) => {
              const calc = productMath(p);
              return (
                <tr key={p.id}>
                  <td>{p.nome}</td>
                  <td>{p.dataVenda}</td>
                  <td className="green">{currency(p.vendaReal)}</td>
                  <td>{currency(calc.custoFinal)}</td>
                  <td className="green strong">{currency(calc.lucroReal)}</td>
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
          <SimpleTable headers={["Produto", "SKU", "Compra", "Frete", "Custo final", "Status"]}>
            {products.map((p) => {
              const calc = productMath(p);
              return (
                <tr key={p.id}>
                  <td>{p.nome}</td>
                  <td>{p.sku}</td>
                  <td>{currency(p.compra)}</td>
                  <td>{currency(p.frete)}</td>
                  <td className="strong">{currency(calc.custoFinal)}</td>
                  <td><Status status={p.status} /></td>
                </tr>
              );
            })}
          </SimpleTable>
        </ModuleCard>
      );
    }

    if (activeMenu === "Custos Extras") {
      return (
        <ModuleCard title="Custos Extras" subtitle="Despesas operacionais fora do custo individual do produto.">
          <div className="extra-cost-form">
            <input placeholder="Descrição" value={extraCost.descricao} onChange={(e) => setExtraCost({ ...extraCost, descricao: e.target.value })} />
            <input type="number" placeholder="Valor" value={extraCost.valor} onChange={(e) => setExtraCost({ ...extraCost, valor: e.target.value })} />
            <input type="date" value={extraCost.data} onChange={(e) => setExtraCost({ ...extraCost, data: e.target.value })} />
            <button onClick={addExtraCost}><Plus size={17} /></button>
          </div>
          <SimpleTable headers={["Descrição", "Data", "Valor", ""]}>
            {extraCosts.map((cost) => (
              <tr key={cost.id}>
                <td>{cost.descricao}</td>
                <td>{cost.data}</td>
                <td className="red">{currency(cost.valor)}</td>
                <td className="right">
                  <button className="icon-btn danger" onClick={() => removeExtraCost(cost.id)}><Trash2 size={18} /></button>
                </td>
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
            <div className="module-actions report-actions">
              <button onClick={exportPdf}><Download size={17} /> Gerar PDF</button>
              <button onClick={exportBackup}><Download size={17} /> Backup JSON</button>
            </div>

            <div className="report-grid">
              <MiniReport title="Estoque" value={currency(summary.valorEstoque)} desc="Capital parado em produtos não vendidos" />
              <MiniReport title="Vendas" value={currency(summary.receitaReal)} desc="Receita realizada" />
              <MiniReport title="Lucro líquido" value={currency(summary.lucroReal - totalExtraCosts)} desc="Lucro real menos custos extras" />
              <MiniReport title="Produtos inativos" value={inactiveProducts.length} desc="Registros com status X" />
            </div>
            <CostDistribution costs={costDistribution} summary={summary} />
          </ModuleCard>

          <ModuleCard title="Gráficos financeiros" subtitle="Indicadores visuais">
            <FinanceCharts summary={summary} totalExtraCosts={totalExtraCosts} />
          </ModuleCard>

          <ModuleCard title="Alertas de estoque baixo" subtitle="Produtos que atingiram o estoque mínimo">
            <LowStockList products={lowStockProducts} />
          </ModuleCard>
        </div>
      );
    }

    if (activeMenu === "Financeiro") {
      if (!permissions.canFinancial) return <NoPermission />;
      return (
        <ModuleCard title="Financeiro" subtitle="Resumo do caixa, lucro e despesas.">
          <div className="two-columns">
            <FinancialSummary summary={{ ...summary, lucroReal: summary.lucroReal - totalExtraCosts }} />
            <ModuleCard title="Caixa Operacional" subtitle="Resumo rápido">
              <Line label="Receita Real" value={currency(summary.receitaReal)} good />
              <Line label="Custo dos vendidos" value={`-${currency(summary.custoVendidos)}`} bad />
              <Line label="Custos extras" value={`-${currency(totalExtraCosts)}`} bad />
              <Line label="Resultado" value={currency(summary.lucroReal - totalExtraCosts)} good />
            </ModuleCard>
          </div>
        </ModuleCard>
      );
    }

    if (activeMenu === "Usuários") {
      if (!permissions.canUsers) return <NoPermission />;
      return (
        <ModuleCard title="Usuários e Permissões" subtitle="Controle de acesso por perfil.">
          <SimpleTable headers={["Nome", "E-mail", "Perfil", "Status"]}>
            {profiles.map((p) => (
              <tr key={p.id || p.user_id}>
                <td>{p.nome || "-"}</td>
                <td>{p.email}</td>
                <td>
                  <select value={p.perfil} onChange={(e) => updateProfileRole(p.id, e.target.value)}>
                    <option value="administrador">Administrador</option>
                    <option value="funcionario">Funcionário</option>
                    <option value="visualizacao">Visualização</option>
                  </select>
                </td>
                <td>{p.status || "A"}</td>
              </tr>
            ))}
          </SimpleTable>
        </ModuleCard>
      );
    }

    if (activeMenu === "Manutenção") {
      return (
        <div className="maintenance-grid">
          <ModuleCard title="Manutenção" subtitle="Itens que tiveram custo de reparo, chip ou ajuste.">
            <SimpleTable headers={["Produto", "Chip", "Manutenção", "Outros", "Total técnico"]}>
              {products
                .filter((p) => Number(p.chip || 0) || Number(p.manutencao || 0))
                .map((p) => (
                  <tr key={p.id}>
                    <td>{p.nome}</td>
                    <td>{currency(p.chip)}</td>
                    <td>{currency(p.manutencao)}</td>
                    <td>{currency(p.outros)}</td>
                    <td className="green strong">{currency(Number(p.chip || 0) + Number(p.manutencao || 0) + Number(p.outros || 0))}</td>
                  </tr>
                ))}
            </SimpleTable>
          </ModuleCard>

          <ModuleCard title="Produtos inativos" subtitle="Produtos com status de registro X.">
            <SimpleTable headers={["Produto", "SKU", "Status", "Ação"]}>
              {inactiveProducts.map((p) => (
                <tr key={p.id}>
                  <td>{p.nome}</td>
                  <td>{p.sku}</td>
                  <td>X</td>
                  <td><button onClick={() => restoreProduct(p.id)}>Restaurar</button></td>
                </tr>
              ))}
            </SimpleTable>
          </ModuleCard>
        </div>
      );
    }

    return (
      <div className="dashboard-grid">
        <section className="main-section">
          <ModuleCard title="Alertas de estoque baixo" subtitle="Produtos que precisam de atenção.">
            <LowStockList products={lowStockProducts} />
          </ModuleCard>

          <ModuleCard title="Produtos em Estoque" subtitle="Custos detalhados, miniaturas, venda esperada, lucro esperado e lucro real.">
            <div className="module-actions">
              {permissions.canCreate && <button onClick={() => setNewProductOpen(true)}><Plus size={17} /> Novo Produto</button>}
            </div>
            <ProductsTable
              products={products}
              updateProduct={updateProduct}
              sellProduct={sellProduct}
              editProduct={setEditingProduct}
              removeProduct={removeProduct}
              setExpandedImage={setExpandedImage}
              permissions={permissions}
            />
          </ModuleCard>

          <div className="two-columns">
            <CostDistribution costs={costDistribution} summary={summary} />
            <RecentSales products={products.filter((p) => p.status === "Vendido")} />
          </div>
        </section>

        <aside className="side-section">
          <FinancialSummary summary={summary} />
          <ModuleCard title="Resumo do menu" subtitle="Rotina ativa">
            <p className="white strong">Menu ativo: {activeMenu}</p>
            <p className="muted">Perfil: {profile?.perfil}</p>
            <p className="muted">Supabase: {syncing ? "sincronizando..." : syncMessage}</p>
          </ModuleCard>
        </aside>
      </div>
    );
  }

  if (loadingAuth) {
    return (
      <div className="login-screen">
        <div className="login-card">
          <h1>Jogador1 Games</h1>
          <p>Carregando sessão...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="login-screen">
        <div className="login-card">
          <div className="login-logo">
            <Gamepad2 size={50} />
          </div>
          <h1>Jogador<span>1</span> Games</h1>
          <p>Sistema Premium de Estoque</p>

          <input
            type="email"
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {authError && <small className="auth-error">{authError}</small>}

          <button onClick={signIn}>Entrar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {expandedImage && (
        <div className="image-overlay" onClick={() => setExpandedImage(null)}>
          <img src={expandedImage} alt="Produto ampliado" />
        </div>
      )}

      {versionOpen && (
        <div className="modal-backdrop">
          <div className="version-modal">
            <div className="modal-header">
              <div>
                <h2>Novidades da versão {APP_VERSION}</h2>
                <p>Resumo das principais alterações aplicadas nesta atualização.</p>
              </div>
              <button onClick={() => setVersionOpen(false)}><X size={18} /> Fechar</button>
            </div>
            <ul>
              <li>Controle de usuários e permissões.</li>
              <li>Upload real de imagens no Supabase Storage.</li>
              <li>Relatórios PDF via impressão do navegador.</li>
              <li>Backup JSON com dados do sistema.</li>
              <li>Gráficos financeiros simples.</li>
              <li>Controle de estoque mínimo e alertas.</li>
              <li>Exclusão lógica de produtos com status de registro X.</li>
              <li>Cards financeiros exibidos apenas em Dashboard e Relatórios.</li>
            </ul>
          </div>
        </div>
      )}

      {newProductOpen && (
        <ProductModal
          title="Cadastrar novo produto"
          product={newProduct}
          setProduct={setNewProduct}
          onClose={() => setNewProductOpen(false)}
          onSave={addProduct}
          saveText="Adicionar ao estoque"
          importImages={importNewImages}
          removeImage={(index) => setNewProduct((prev) => ({ ...prev, imagens: prev.imagens.filter((_, i) => i !== index) }))}
          setExpandedImage={setExpandedImage}
        />
      )}

      {editingProduct && (
        <ProductModal
          title="Editar produto"
          product={editingProduct}
          setProduct={setEditingProduct}
          onClose={() => setEditingProduct(null)}
          onSave={saveEdit}
          saveText="Salvar alterações"
          importImages={importEditImages}
          removeImage={(index) => setEditingProduct((prev) => ({ ...prev, imagens: prev.imagens.filter((_, i) => i !== index) }))}
          setExpandedImage={setExpandedImage}
          editing
        />
      )}

      <div className="layout">
        <aside className="sidebar">
          <div className="brand">
            <div className="brand-icon"><Gamepad2 size={54} /></div>
            <h1>JOGADOR<span>1</span></h1>
            <p>GAMES</p>
          </div>

          <nav>
            {menus.map(([label, Icon]) => (
              <button
                key={label}
                type="button"
                onClick={() => setActiveMenu(label)}
                className={activeMenu === label ? "active" : ""}
              >
                <Icon size={18} />
                {label}
              </button>
            ))}
          </nav>

          <div className="sidebar-profit">
            <p>Lucro real vendido</p>
            <strong>{currency(summary.lucroReal - totalExtraCosts)}</strong>
            <small>Perfil: {profile?.perfil}</small>
          </div>

          <button className="logout-btn" onClick={signOut}>
            <LogOut size={16} />
            Sair
          </button>
        </aside>

        <main className="content">
          <header className="topbar">
            <div className="topbar-title">
              <div className="topbar-icon"><LayoutDashboard size={24} /></div>
              <div>
                <h2>{activeMenu}</h2>
                <p>Rotina ativa do sistema Jogador1 Games.</p>
                <small>{syncing ? "Sincronizando..." : syncMessage}</small>
              </div>
            </div>

            <div className="topbar-actions">
              <div className="date-pill"><CalendarDays size={17} /> Maio/2026</div>
              <div className="capital-pill">
                <p>Capital total</p>
                <strong>{currency(summary.capitalInvestido)}</strong>
              </div>
            </div>
          </header>

          {showStats && (
            <section className="stats">
              <Stat icon={Wallet} title="Capital Investido" value={currency(summary.capitalInvestido)} subtitle="Total aplicado" color="red" />
              <Stat icon={Boxes} title="Valor em Estoque" value={currency(summary.valorEstoque)} subtitle="Não vendidos" color="white" />
              <Stat icon={TrendingUp} title="Lucro Esperado" value={currency(summary.lucroEsperado)} subtitle="Venda prevista" color="green" />
              <Stat icon={DollarSign} title="Lucro Real" value={currency(summary.lucroReal - totalExtraCosts)} subtitle="Após despesas" color="purple" />
              <Stat icon={Package} title="Produtos em Estoque" value={summary.produtosEstoque} subtitle="Disponíveis" color="amber" />
            </section>
          )}

          {renderModule()}

          <footer className="version-footer">
            Atualizado com a versão {APP_VERSION}.{" "}
            <button onClick={() => setVersionOpen(true)}>Clique aqui e saiba as novidades.</button>
          </footer>
        </main>
      </div>
    </div>
  );
}

function ProductModal({ title, product, setProduct, onClose, onSave, saveText, importImages, removeImage, setExpandedImage, editing }) {
  const cost =
    Number(product.compra || 0) +
    Number(product.chip || 0) +
    Number(product.frete || 0) +
    Number(product.manutencao || 0) +
    Number(product.outros || 0);
  const profit = Number(product.vendaEsperada || 0) - cost;

  return (
    <div className="modal-backdrop">
      <div className="product-modal">
        <div className="modal-header">
          <div>
            <h2>{title}</h2>
            <p>Preencha os custos, valor esperado de venda e importe até 6 imagens.</p>
          </div>
          <button onClick={onClose}><X size={18} /> Fechar</button>
        </div>

        <div className="modal-grid">
          <div className="modal-left">
            <FormSection title="Identificação">
              <div className="form-grid">
                <input value={product.nome} onChange={(e) => setProduct({ ...product, nome: e.target.value })} placeholder="Nome do produto" />
                <input value={product.sku} onChange={(e) => setProduct({ ...product, sku: e.target.value })} placeholder="SKU / Código interno" />
              </div>
            </FormSection>

            <FormSection title="Estoque">
              <div className="form-grid">
                <input type="number" value={product.quantidade} onChange={(e) => setProduct({ ...product, quantidade: e.target.value })} placeholder="Quantidade" />
                <input type="number" value={product.estoqueMinimo} onChange={(e) => setProduct({ ...product, estoqueMinimo: e.target.value })} placeholder="Estoque mínimo" />
              </div>
            </FormSection>

            <FormSection title="Custos do produto">
              <div className="form-grid">
                <input type="number" value={product.compra} onChange={(e) => setProduct({ ...product, compra: e.target.value })} placeholder="Preço de compra" />
                <input type="number" value={product.chip} onChange={(e) => setProduct({ ...product, chip: e.target.value })} placeholder="Chip / desbloqueio" />
                <input type="number" value={product.frete} onChange={(e) => setProduct({ ...product, frete: e.target.value })} placeholder="Frete" />
                <input type="number" value={product.manutencao} onChange={(e) => setProduct({ ...product, manutencao: e.target.value })} placeholder="Manutenção" />
                <input type="number" value={product.outros} onChange={(e) => setProduct({ ...product, outros: e.target.value })} placeholder="Outros custos" />
              </div>
            </FormSection>

            <FormSection title="Venda">
              <div className="form-grid">
                <input type="number" value={product.vendaEsperada} onChange={(e) => setProduct({ ...product, vendaEsperada: e.target.value })} placeholder="Valor esperado de venda" />
                {editing && <input type="number" value={product.vendaReal} onChange={(e) => setProduct({ ...product, vendaReal: e.target.value })} placeholder="Venda real" />}
              </div>
            </FormSection>
          </div>

          <div className="modal-right">
            <FormSection title="Imagens">
              <input className="file-input" type="file" accept="image/*" multiple onChange={importImages} />
              <p className="muted">Você pode importar em etapas, até completar 6 imagens.</p>
              <ImagesGrid images={product.imagens} removeImage={removeImage} setExpandedImage={setExpandedImage} />
            </FormSection>

            <div className="profit-box">
              <p>Custo final estimado</p>
              <strong>{currency(cost)}</strong>
              <p>Lucro esperado</p>
              <strong className="green">{currency(profit)}</strong>
            </div>

            <button onClick={onSave} className="full-button"><Plus size={18} /> {saveText}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FormSection({ title, children }) {
  return (
    <div className="form-section">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

function ImagesGrid({ images = [], removeImage, setExpandedImage }) {
  const emptySlots = Math.max(0, 6 - images.length);

  return (
    <div className="images-grid">
      {images.map((image, index) => (
        <div key={index} className="image-slot filled">
          <button type="button" onClick={() => setExpandedImage(imageSrc(image))}>
            <img src={imageSrc(image)} alt={`Produto ${index + 1}`} />
          </button>
          <button type="button" className="delete-image" onClick={() => removeImage(index)}>
            <Trash2 size={14} />
          </button>
        </div>
      ))}

      {Array.from({ length: emptySlots }).map((_, index) => (
        <div key={`empty-${index}`} className="image-slot empty">
          <ImagePlus size={22} />
        </div>
      ))}
    </div>
  );
}

function ProductsTable({ products, updateProduct, sellProduct, editProduct, removeProduct, setExpandedImage, permissions }) {
  return (
    <div className="table-wrap">
      <table className="products-table">
        <thead>
          <tr>
            <th>Produto</th>
            <th>Estoque</th>
            <th>Custos detalhados</th>
            <th>Custo final</th>
            <th>Venda esperada</th>
            <th>Lucro esperado</th>
            <th>Venda real</th>
            <th>Lucro real</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>

        <tbody>
          {products.map((product) => {
            const calc = productMath(product);
            return (
              <tr key={product.id} className={Number(product.quantidade || 0) <= Number(product.estoqueMinimo || 0) ? "low-stock-row" : ""}>
                <td>
                  <div className="product-cell">
                    <button className="thumb" onClick={() => setExpandedImage(imageSrc(product.imagens?.[0]))}>
                      {product.imagens?.[0] ? <img src={imageSrc(product.imagens[0])} alt={product.nome} /> : <ImagePlus />}
                    </button>
                    <div>
                      <input value={product.nome} onChange={(e) => updateProduct(product.id, "nome", e.target.value)} disabled={!permissions.canEdit} />
                      <input value={product.sku} onChange={(e) => updateProduct(product.id, "sku", e.target.value)} disabled={!permissions.canEdit} />
                    </div>
                  </div>
                </td>

                <td>
                  <div className="stock-grid">
                    <input type="number" value={product.quantidade} onChange={(e) => updateProduct(product.id, "quantidade", e.target.value)} disabled={!permissions.canEdit} />
                    <input type="number" value={product.estoqueMinimo} onChange={(e) => updateProduct(product.id, "estoqueMinimo", e.target.value)} disabled={!permissions.canEdit} />
                  </div>
                </td>

                <td>
                  <div className="cost-grid">
                    <input type="number" value={product.compra} onChange={(e) => updateProduct(product.id, "compra", e.target.value)} disabled={!permissions.canEdit} />
                    <input type="number" value={product.chip} onChange={(e) => updateProduct(product.id, "chip", e.target.value)} disabled={!permissions.canEdit} />
                    <input type="number" value={product.frete} onChange={(e) => updateProduct(product.id, "frete", e.target.value)} disabled={!permissions.canEdit} />
                    <input type="number" value={product.manutencao} onChange={(e) => updateProduct(product.id, "manutencao", e.target.value)} disabled={!permissions.canEdit} />
                    <input type="number" value={product.outros} onChange={(e) => updateProduct(product.id, "outros", e.target.value)} disabled={!permissions.canEdit} />
                  </div>
                </td>

                <td className="strong">{currency(calc.custoFinal)}</td>
                <td><input type="number" className="wide-money-input" value={product.vendaEsperada} onChange={(e) => updateProduct(product.id, "vendaEsperada", e.target.value)} disabled={!permissions.canEdit} /></td>
                <td className="green strong">{currency(calc.lucroEsperado)}</td>
                <td><input type="number" className="wide-money-input" value={product.vendaReal} onChange={(e) => updateProduct(product.id, "vendaReal", e.target.value)} placeholder="Após vender" disabled={!permissions.canEdit} /></td>
                <td className="green strong">{product.status === "Vendido" ? currency(calc.lucroReal) : "-"}</td>
                <td><Status status={product.status} /></td>
                <td>
                  <div className="row-actions">
                    {permissions.canSell && <button className="sold-btn" onClick={() => sellProduct(product.id)}>Vendido</button>}
                    {permissions.canEdit && <button className="icon-btn" onClick={() => editProduct(product)}><Pencil size={18} /></button>}
                    {permissions.canDelete && <button className="icon-btn danger" onClick={() => removeProduct(product.id)}><Trash2 size={18} /></button>}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ModuleCard({ title, subtitle, children }) {
  return (
    <div className="module-card">
      <div className="module-header">
        <h3><Package size={20} /> {title}</h3>
        <p>{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

function SimpleTable({ headers, children }) {
  return (
    <div className="table-wrap">
      <table className="simple-table">
        <thead>
          <tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Stat({ title, value, subtitle, icon: Icon, color }) {
  return (
    <div className={`stat-card ${color}`}>
      <div>
        <p>{title}</p>
        <strong>{value}</strong>
        <small>{subtitle}</small>
      </div>
      <span><Icon size={22} /></span>
    </div>
  );
}

function Status({ status }) {
  if (status === "Vendido") return <span className="status sold">Vendido</span>;
  if (status === "Reservado") return <span className="status reserved">Reservado</span>;
  return <span className="status stock">Em estoque</span>;
}

function Line({ label, value, good, bad }) {
  return (
    <div className="line">
      <span>{label}</span>
      <strong className={good ? "green" : bad ? "red" : ""}>{value}</strong>
    </div>
  );
}

function FinancialSummary({ summary }) {
  return (
    <ModuleCard title="Resumo Financeiro" subtitle="Resultado operacional">
      <Line label="Faturamento" value={currency(summary.receitaReal)} good />
      <Line label="Custo dos vendidos" value={`-${currency(summary.custoVendidos)}`} bad />
      <Line label="Lucro bruto" value={currency(summary.lucroReal)} good />
      <Line label="Lucro esperado" value={currency(summary.lucroEsperado)} good />
    </ModuleCard>
  );
}

function CostDistribution({ costs, summary }) {
  return (
    <ModuleCard title="Distribuição dos custos" subtitle="Composição do capital">
      <div className="cost-bars">
        {costs.map(([name, value, cls]) => {
          const percent = summary.capitalInvestido ? (value / summary.capitalInvestido) * 100 : 0;
          return (
            <div key={name}>
              <div className="bar-label">
                <span>{name}</span>
                <strong>{currency(value)} ({percent.toFixed(1)}%)</strong>
              </div>
              <div className="bar-bg"><div className={cls} style={{ width: `${Math.min(100, percent)}%` }} /></div>
            </div>
          );
        })}
      </div>
    </ModuleCard>
  );
}

function RecentSales({ products }) {
  return (
    <ModuleCard title="Vendas recentes" subtitle="Últimas vendas">
      <div className="recent-list">
        {products.map((p) => {
          const calc = productMath(p);
          return (
            <div key={p.id} className="recent-item">
              <div><strong>{p.nome}</strong><small>{p.dataVenda}</small></div>
              <span>{currency(calc.lucroReal)}</span>
            </div>
          );
        })}
      </div>
    </ModuleCard>
  );
}

function MiniReport({ title, value, desc }) {
  return (
    <div className="mini-report">
      <p>{title}</p>
      <strong>{value}</strong>
      <small>{desc}</small>
    </div>
  );
}

function FinanceCharts({ summary, totalExtraCosts }) {
  const max = Math.max(summary.receitaReal, summary.valorEstoque, summary.lucroEsperado, totalExtraCosts, 1);
  const items = [
    ["Receita", summary.receitaReal, "bar-green"],
    ["Estoque", summary.valorEstoque, "bar-white"],
    ["Lucro esperado", summary.lucroEsperado, "bar-yellow"],
    ["Custos extras", totalExtraCosts, "bar-red"],
  ];

  return (
    <div className="finance-chart">
      {items.map(([label, value, cls]) => (
        <div key={label}>
          <div className="bar-label"><span>{label}</span><strong>{currency(value)}</strong></div>
          <div className="bar-bg"><div className={cls} style={{ width: `${Math.max(4, (value / max) * 100)}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

function LowStockList({ products }) {
  if (!products.length) return <p className="muted">Nenhum produto abaixo ou igual ao estoque mínimo.</p>;

  return (
    <div className="low-stock-list">
      {products.map((p) => (
        <div key={p.id} className="low-stock-item">
          <strong>{p.nome}</strong>
          <span>Qtd: {p.quantidade} / Mínimo: {p.estoqueMinimo}</span>
        </div>
      ))}
    </div>
  );
}

function NoPermission() {
  return (
    <ModuleCard title="Acesso restrito" subtitle="Seu perfil não possui permissão para esta rotina.">
      <p className="muted">Solicite acesso a um administrador.</p>
    </ModuleCard>
  );
}
