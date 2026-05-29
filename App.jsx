
import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  BarChart3,
  Boxes,
  CalendarDays,
  DollarSign,
  Gamepad2,
  ImagePlus,
  LayoutDashboard,
  Package,
  Pencil,
  Plus,
  ReceiptText,
  ShoppingCart,
  Trash2,
  TrendingUp,
  Wallet,
  Wrench,
  X,
} from "lucide-react";

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
  imagens: [],
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

export default function App() {
  const [activeMenu, setActiveMenu] = useState("Dashboard");
  const [products, setProducts] = useState([
    {
      id: crypto.randomUUID(),
      nome: "Nintendo Switch V2 Desbloqueado",
      sku: "NSW-001",
      compra: 1150,
      chip: 100,
      frete: 50,
      manutencao: 30,
      outros: 20,
      vendaEsperada: 1600,
      vendaReal: 1500,
      status: "Vendido",
      dataVenda: "27/05/2026",
      imagens: [placeholderImage("SWITCH", "#dc2626")],
    },
    {
      id: crypto.randomUUID(),
      nome: "PlayStation 5 Slim Digital",
      sku: "PS5D-001",
      compra: 2000,
      chip: 0,
      frete: 80,
      manutencao: 50,
      outros: 20,
      vendaEsperada: 2550,
      vendaReal: "",
      status: "Em estoque",
      dataVenda: "",
      imagens: [placeholderImage("PS5", "#ffffff")],
    },
  ]);

  const [newProduct, setNewProduct] = useState(emptyProduct);
  const [newProductOpen, setNewProductOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [expandedImage, setExpandedImage] = useState(null);
  const [syncMessage, setSyncMessage] = useState("Aguardando conexão com Supabase...");
  const [syncing, setSyncing] = useState(false);

  const [extraCost, setExtraCost] = useState({ descricao: "", valor: "", data: "" });
  const [extraCosts, setExtraCosts] = useState([
    { id: crypto.randomUUID(), descricao: "Embalagens", valor: 45, data: "28/05/2026" },
    { id: crypto.randomUUID(), descricao: "Etiqueta de segurança", valor: 35, data: "28/05/2026" },
  ]);

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    if (!supabase) {
      setSyncMessage("Configure as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.");
      return;
    }

    setSyncing(true);
    const { data, error } = await supabase
      .from("produtos")
      .select("*, produto_imagens(imagem_url)")
      .order("criado_em", { ascending: false });

    if (error) {
      setSyncMessage(`Erro ao carregar Supabase: ${error.message}`);
      setSyncing(false);
      return;
    }

    if (data?.length) {
      setProducts(
        data.map((p) => ({
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
          dataVenda: "",
          imagens: (p.produto_imagens || []).map((img) => img.imagem_url),
        }))
      );
      setSyncMessage("Produtos carregados do Supabase.");
    } else {
      setSyncMessage("Banco conectado. Nenhum produto salvo ainda.");
    }

    setSyncing(false);
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
    ["Manutenção", Wrench],
  ];

  function readImages(event, callback) {
    const files = Array.from(event.target.files || []);
    Promise.all(
      files.map(
        (file) =>
          new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(file);
          })
      )
    ).then((images) => {
      callback(images);
      event.target.value = "";
    });
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
      dataVenda: "",
      imagens: newProduct.imagens.length ? newProduct.imagens : [placeholderImage("NOVO")],
    };

    if (!supabase) {
      setProducts((prev) => [product, ...prev]);
      setNewProduct(emptyProduct);
      setNewProductOpen(false);
      return;
    }

    const calc = productMath(product);
    setSyncing(true);
    setSyncMessage("Salvando produto no Supabase...");

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
      })
      .select()
      .single();

    if (error) {
      setSyncMessage(`Erro ao salvar: ${error.message}`);
      setSyncing(false);
      return;
    }

    if (product.imagens.length) {
      await supabase.from("produto_imagens").insert(
        product.imagens.map((image) => ({
          produto_id: data.id,
          imagem_url: image,
        }))
      );
    }

    setProducts((prev) => [{ ...product, id: data.id }, ...prev]);
    setNewProduct(emptyProduct);
    setNewProductOpen(false);
    setSyncMessage("Produto salvo no Supabase.");
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

  function sellProduct(id) {
    setProducts((prev) =>
      prev.map((product) =>
        product.id === id
          ? { ...product, status: "Vendido", vendaReal: product.vendaReal || product.vendaEsperada, dataVenda: product.dataVenda || "Hoje" }
          : product
      )
    );
  }

  function saveEdit() {
    setProducts((prev) => prev.map((item) => (item.id === editingProduct.id ? editingProduct : item)));
    setEditingProduct(null);
  }

  function removeExtraCost(id) {
    setExtraCosts((prev) => prev.filter((item) => item.id !== id));
  }

  function addExtraCost() {
    if (!extraCost.descricao || !extraCost.valor) return;
    setExtraCosts((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        descricao: extraCost.descricao,
        valor: Number(extraCost.valor || 0),
        data: extraCost.data || "Hoje",
      },
    ]);
    setExtraCost({ descricao: "", valor: "", data: "" });
  }

  function renderModule() {
    if (activeMenu === "Produtos") {
      return (
        <ModuleCard title="Produtos" subtitle="Cadastro, edição, imagem e controle de estoque.">
          <div className="module-actions">
            <Button onClick={() => setNewProductOpen(true)}><Plus size={17} /> Cadastrar Produto</Button>
          </div>
          <ProductsTable
            products={products}
            updateProduct={updateProduct}
            sellProduct={sellProduct}
            editProduct={setEditingProduct}
            removeProduct={(id) => setProducts((prev) => prev.filter((x) => x.id !== id))}
            setExpandedImage={setExpandedImage}
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
            <Input placeholder="Descrição" value={extraCost.descricao} onChange={(e) => setExtraCost({ ...extraCost, descricao: e.target.value })} />
            <Input type="number" placeholder="Valor" value={extraCost.valor} onChange={(e) => setExtraCost({ ...extraCost, valor: e.target.value })} />
            <Input type="date" value={extraCost.data} onChange={(e) => setExtraCost({ ...extraCost, data: e.target.value })} />
            <Button onClick={addExtraCost}><Plus size={17} /></Button>
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
        <ModuleCard title="Relatórios" subtitle="Visão consolidada da operação.">
          <div className="report-grid">
            <MiniReport title="Estoque" value={currency(summary.valorEstoque)} desc="Capital parado em produtos não vendidos" />
            <MiniReport title="Vendas" value={currency(summary.receitaReal)} desc="Receita realizada" />
            <MiniReport title="Lucro líquido" value={currency(summary.lucroReal - totalExtraCosts)} desc="Lucro real menos custos extras" />
          </div>
          <CostDistribution costs={costDistribution} summary={summary} />
        </ModuleCard>
      );
    }

    if (activeMenu === "Financeiro") {
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

    if (activeMenu === "Manutenção") {
      return (
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
      );
    }

    return (
      <div className="dashboard-grid">
        <section className="main-section">
          <ModuleCard title="Produtos em Estoque" subtitle="Custos detalhados, miniaturas, venda esperada, lucro esperado e lucro real.">
            <div className="module-actions">
              <Button onClick={() => setNewProductOpen(true)}><Plus size={17} /> Novo Produto</Button>
            </div>
            <ProductsTable
              products={products}
              updateProduct={updateProduct}
              sellProduct={sellProduct}
              editProduct={setEditingProduct}
              removeProduct={(id) => setProducts((prev) => prev.filter((x) => x.id !== id))}
              setExpandedImage={setExpandedImage}
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
            <p className="muted">Cada item do menu lateral abre sua própria tela.</p>
            <p className="muted">Supabase: {syncing ? "sincronizando..." : syncMessage}</p>
          </ModuleCard>
        </aside>
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
            <small>Após custos extras</small>
          </div>
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

          <section className="stats">
            <Stat icon={Wallet} title="Capital Investido" value={currency(summary.capitalInvestido)} subtitle="Total aplicado" color="red" />
            <Stat icon={Boxes} title="Valor em Estoque" value={currency(summary.valorEstoque)} subtitle="Não vendidos" color="white" />
            <Stat icon={TrendingUp} title="Lucro Esperado" value={currency(summary.lucroEsperado)} subtitle="Venda prevista" color="green" />
            <Stat icon={DollarSign} title="Lucro Real" value={currency(summary.lucroReal - totalExtraCosts)} subtitle="Após despesas" color="purple" />
            <Stat icon={Package} title="Produtos em Estoque" value={summary.produtosEstoque} subtitle="Disponíveis" color="amber" />
          </section>

          {renderModule()}
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
                <Input value={product.nome} onChange={(e) => setProduct({ ...product, nome: e.target.value })} placeholder="Nome do produto" />
                <Input value={product.sku} onChange={(e) => setProduct({ ...product, sku: e.target.value })} placeholder="SKU / Código interno" />
              </div>
            </FormSection>

            <FormSection title="Custos do produto">
              <div className="form-grid">
                <Input type="number" value={product.compra} onChange={(e) => setProduct({ ...product, compra: e.target.value })} placeholder="Preço de compra" />
                <Input type="number" value={product.chip} onChange={(e) => setProduct({ ...product, chip: e.target.value })} placeholder="Chip / desbloqueio" />
                <Input type="number" value={product.frete} onChange={(e) => setProduct({ ...product, frete: e.target.value })} placeholder="Frete" />
                <Input type="number" value={product.manutencao} onChange={(e) => setProduct({ ...product, manutencao: e.target.value })} placeholder="Manutenção" />
                <Input type="number" value={product.outros} onChange={(e) => setProduct({ ...product, outros: e.target.value })} placeholder="Outros custos" />
              </div>
            </FormSection>

            <FormSection title="Venda">
              <div className="form-grid">
                <Input type="number" value={product.vendaEsperada} onChange={(e) => setProduct({ ...product, vendaEsperada: e.target.value })} placeholder="Valor esperado de venda" />
                {editing && <Input type="number" value={product.vendaReal} onChange={(e) => setProduct({ ...product, vendaReal: e.target.value })} placeholder="Venda real" />}
              </div>
            </FormSection>
          </div>

          <div className="modal-right">
            <FormSection title="Imagens">
              <Input className="file-input" type="file" accept="image/*" multiple onChange={importImages} />
              <p className="muted">Você pode importar em etapas, até completar 6 imagens.</p>
              <ImagesGrid images={product.imagens} removeImage={removeImage} setExpandedImage={setExpandedImage} />
            </FormSection>

            <div className="profit-box">
              <p>Custo final estimado</p>
              <strong>{currency(cost)}</strong>
              <p>Lucro esperado</p>
              <strong className="green">{currency(profit)}</strong>
            </div>

            <Button onClick={onSave} className="full-button"><Plus size={18} /> {saveText}</Button>
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
          <button type="button" onClick={() => setExpandedImage(image)}>
            <img src={image} alt={`Produto ${index + 1}`} />
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

function ProductsTable({ products, updateProduct, sellProduct, editProduct, removeProduct, setExpandedImage }) {
  return (
    <div className="table-wrap">
      <table className="products-table">
        <thead>
          <tr>
            <th>Produto</th>
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
              <tr key={product.id}>
                <td>
                  <div className="product-cell">
                    <button className="thumb" onClick={() => setExpandedImage(product.imagens?.[0])}>
                      {product.imagens?.[0] ? <img src={product.imagens[0]} alt={product.nome} /> : <ImagePlus />}
                    </button>
                    <div>
                      <Input value={product.nome} onChange={(e) => updateProduct(product.id, "nome", e.target.value)} />
                      <Input value={product.sku} onChange={(e) => updateProduct(product.id, "sku", e.target.value)} />
                    </div>
                  </div>
                </td>

                <td>
                  <div className="cost-grid">
                    <Input type="number" value={product.compra} onChange={(e) => updateProduct(product.id, "compra", e.target.value)} />
                    <Input type="number" value={product.chip} onChange={(e) => updateProduct(product.id, "chip", e.target.value)} />
                    <Input type="number" value={product.frete} onChange={(e) => updateProduct(product.id, "frete", e.target.value)} />
                    <Input type="number" value={product.manutencao} onChange={(e) => updateProduct(product.id, "manutencao", e.target.value)} />
                    <Input type="number" value={product.outros} onChange={(e) => updateProduct(product.id, "outros", e.target.value)} />
                  </div>
                </td>

                <td className="strong">{currency(calc.custoFinal)}</td>
                <td><Input type="number" value={product.vendaEsperada} onChange={(e) => updateProduct(product.id, "vendaEsperada", e.target.value)} /></td>
                <td className="green strong">{currency(calc.lucroEsperado)}</td>
                <td><Input type="number" value={product.vendaReal} onChange={(e) => updateProduct(product.id, "vendaReal", e.target.value)} placeholder="Após vender" /></td>
                <td className="green strong">{product.status === "Vendido" ? currency(calc.lucroReal) : "-"}</td>
                <td><Status status={product.status} /></td>
                <td>
                  <div className="row-actions">
                    <button className="sold-btn" onClick={() => sellProduct(product.id)}>Vendido</button>
                    <button className="icon-btn" onClick={() => editProduct(product)}><Pencil size={18} /></button>
                    <button className="icon-btn danger" onClick={() => removeProduct(product.id)}><Trash2 size={18} /></button>
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
