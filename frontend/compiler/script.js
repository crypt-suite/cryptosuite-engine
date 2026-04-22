

const nodeInfo = {
    "Program": "Root of the program",
    "LetStmt": "Variable declaration",
    "AssignStmt": "Variable assignment",
    "PrintStmt": "Print output",

    "String": "String literal",
    "Number": "Numeric literal",
    "Var": "Variable usage",

    "+": "Addition",
    "-": "Subtraction",
    "*": "Multiplication",
    "/": "Division",

    "Encrypt": "Encryption operation",
    "EncryptExpr": "Encryption operation",
    "DecryptExpr": "Decryption operation",

    "IfStmt": "Conditional statement",
    "ElseStmt": "Else branch",
    "WhileStmt": "Loop",

    "FuncDef": "Function definition",
    "FuncCall": "Function call",
    "ReturnStmt": "Return value"
};




let treeData = {
    name: "Program",
    children: [
        {
            name: "LetStmt",
            children: [
                { name: "msg" },
                { name: "\"abc\"" }
            ]
        },
        {
            name: "LetStmt",
            children: [
                { name: "enc" },
                {
                    name: "Encrypt",
                    children: [{ name: "msg" }]
                }
            ]
        },
        {
            name: "Print",
            children: [{ name: "enc" }]
        }
    ]
};





function extractCFG(output) {
    const match = output.match(/\[CFG_START\]([\s\S]*?)\[CFG_END\]/);
    if (!match) return null;
    try {
        return JSON.parse(match[1]);
    } catch (e) {
        console.error("Invalid CFG JSON", e);
        return null;
    }
}

/*
function extractSemantic(output) {
    const startStr = "=== SEMANTIC ANALYSIS ===";
    const endStr = "=== INTERMEDIATE CODE GENERATION ===";
    
    const start = output.indexOf(startStr);
    const end = output.indexOf(endStr);
    
    if (start === -1 || end === -1) return "Semantic Analysis did not complete.";
    
    // Extract everything between the headers
    let text = output.substring(start + startStr.length, end).trim();
    
    // --- THE FIX: Delete the hidden Symbol Table JSON! ---
    text = text.replace(/\[SYMTAB_START\][\s\S]*?\[SYMTAB_END\]\n?/g, '').trim();
    
    // If it's empty, it means there were no error messages printed!
    return text ? text : "✔ No errors";
}
*/
function drawCFG(data) {
    d3.select("#cfg").selectAll("*").remove();

    const width = 800;
    const height = 400;

    const svg = d3.select("#cfg")
        .attr("viewBox", [0, 0, width, height])
        .style("background", "#020617");

    // Define arrowhead marker
    svg.append("defs").append("marker")
        .attr("id", "arrowhead")
        .attr("viewBox", "-0 -5 10 10")
        //  set refX to 10 so it sits perfectly flush with the edge calculate
        .attr("refX", 10) 
        .attr("refY", 0)
        .attr("orient", "auto")
        .attr("markerWidth", 10)
        .attr("markerHeight", 10)
        .append("path")
        .attr("d", "M 0,-5 L 10,0 L 0,5")
        .attr("fill", "#94a3b8");

    // Pre-calculate node dimensions based on number of instructions
    data.nodes.forEach(d => {
        d.width = 160;
        d.height = (d.label.split('\n').length * 15) + 15;
    });

    // Physics Engine (Upgraded with collision detection)
    const simulation = d3.forceSimulation(data.nodes)
        .force("link", d3.forceLink(data.links).id(d => d.id).distance(180)) // Push boxes further apart
        .force("charge", d3.forceManyBody().strength(-1000))
        .force("center", d3.forceCenter(width / 2, height / 2))
        // Stop boxes from overlapping the lines
        .force("collide", d3.forceCollide().radius(d => Math.max(d.width, d.height) / 1.5)); 

    // Draw Jump Lines (Edges) - Switched to path for precision drawing
    const link = svg.append("g")
        .selectAll("path")
        .data(data.links)
        .join("path")
        .attr("fill", "none")
        .attr("stroke", "#94a3b8")
        .attr("stroke-opacity", 0.8)
        .attr("stroke-width", 2)
        .attr("marker-end", "url(#arrowhead)");

    // Draw Basic Blocks (Nodes)
    const node = svg.append("g")
        .selectAll("g")
        .data(data.nodes)
        .join("g")
        .call(d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended));

    // The dark box
    node.append("rect")
        .attr("width", d => d.width)
        .attr("height", d => d.height)
        .attr("x", d => -d.width / 2)
        .attr("y", d => -d.height / 2)
        .attr("rx", 5)
        .attr("fill", "#1e293b")
        .attr("stroke", "#38bdf8")
        .attr("stroke-width", 2);

    // The text instructions inside the box
    node.append("text")
        .attr("fill", "#e2e8f0")
        .attr("font-family", "monospace")
        .attr("font-size", "11px")
        .attr("text-anchor", "start")
        .attr("y", d => -d.height / 2 + 5) // Start text from the top edge
        .selectAll("tspan")
        .data(d => d.label.split('\n'))
        .join("tspan")
        .attr("x", -70)
        .attr("dy", "14px")
        .text(d => d);

    // Physics ticks - Edge Intersection Math
    simulation.on("tick", () => {
        link.attr("d", d => {
            const dx = d.target.x - d.source.x;
            const dy = d.target.y - d.source.y;
            
            if (dx === 0 && dy === 0) return `M ${d.source.x},${d.source.y} L ${d.target.x},${d.target.y}`;

            const w = d.target.width / 2;
            const h = d.target.height / 2;
            
            let tgtX, tgtY;
            
            // Calculate exactly where the line hits the rectangular boundary
            if (Math.abs(dx) * h > Math.abs(dy) * w) {
                tgtX = d.target.x - (dx > 0 ? w : -w);
                tgtY = d.target.y - (dy * w / Math.abs(dx)) * (dx > 0 ? 1 : -1);
            } else {
                tgtY = d.target.y - (dy > 0 ? h : -h);
                tgtX = d.target.x - (dx * h / Math.abs(dy)) * (dy > 0 ? 1 : -1);
            }

            return `M ${d.source.x},${d.source.y} L ${tgtX},${tgtY}`;
        });

        //node.attr("transform", d => `translate(${d.x},${d.y})`);

        // --- Bounding Box Constraints! ---
        node.attr("transform", d => {
            // Prevent the box from ever crossing the 800x400 SVG boundaries
            d.x = Math.max(d.width / 2 + 10, Math.min(width - d.width / 2 - 10, d.x));
            d.y = Math.max(d.height / 2 + 10, Math.min(height - d.height / 2 - 10, d.y));
            return `translate(${d.x},${d.y})`;
        });
    });

    // Drag constraints
    function dragstarted(event) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
    }
    function dragged(event) {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
    }
    function dragended(event) {
        if (!event.active) simulation.alphaTarget(0);
        event.subject.fx = null;
        event.subject.fy = null;
    }
}


async function runAll() {
    
   const code = document.getElementById("codeInput").value;

       const category = document.getElementById("parserCategory").value;
    const type = document.getElementById("parserType").value;




let inputData = "";

    // If LL(1) is selected (Top-Down -> 2), the C++ backend expects the grammar choice next
    if (category === "1" && type === "2") {
        const grammar = document.getElementById("grammarType").value;
        inputData = `${category}\n${type}\n${grammar}\n${code}\nEND\n`;
    } else {
        // Otherwise, just send category, type, and code
        inputData = `${category}\n${type}\n${code}\nEND\n`;
    }

    const res = await fetch("/api/run", {
        method: "POST",
        headers: {
            "Content-Type": "text/plain" // to tell the server it's raw code
        },
        body: inputData
    });

    const fullOutput = await res.text();


    

    const lex = extractLexical(fullOutput);
    renderLexicalOutput(lex);

    const tree = extractTree(fullOutput);
    if (tree) {
        drawTree(tree);
    }

    const cfgData = extractCFG(fullOutput);
    if (cfgData) drawCFG(cfgData);

    const trace = extractTrace(fullOutput);
    if (trace) animateMemory(trace);

    

// Dynamic extraction for the rest of the panels
    document.getElementById("semantic").textContent = extractSemantic(fullOutput);
    document.getElementById("tac").textContent = extractTAC(fullOutput);
    document.getElementById("exec").textContent = extractExec(fullOutput);

    // --- TRIGGER THE SYMBOL TABLE ---
    const symTabData = extractSymTab(fullOutput);
    if (symTabData) renderSymTab(symTabData);
    
}



// --- NEW EXTRACTION HELPER FUNCTIONS ---

function extractSemantic(output) {
    const startStr = "=== SEMANTIC ANALYSIS ===";
    const endStr = "=== INTERMEDIATE CODE GENERATION ===";
    
    const start = output.indexOf(startStr);
    const end = output.indexOf(endStr);
    
    if (start === -1 || end === -1) return "Semantic Analysis did not complete.";
    
    // Extract everything between the headers
    let text = output.substring(start + startStr.length, end).trim();
    
    // --- THE FIX: Strip out the hidden JSON Symbol Table data! ---
    text = text.replace(/\[SYMTAB_START\][\s\S]*?\[SYMTAB_END\]\n?/g, '').trim();
    
    // If it's empty, it means there were no error messages printed!
    return text ? text : "✔ No errors";
}

function extractTAC(output) {
    const startStr = "=== Three Address Code ===";
    const endStr = "=== IR BEFORE OPT ===";
    
    const start = output.indexOf(startStr);
    const end = output.indexOf(endStr);
    
    if (start === -1 || end === -1) return "TAC generation failed or was not reached.";
    
    return output.substring(start + startStr.length, end).trim();
}

function extractExec(output) {
    const startStr = "=== Bytecode Execution ===";
    const start = output.indexOf(startStr);
    
    if (start === -1) return "Execution engine did not run (possibly due to earlier errors).";
    
    // Grab the text
    let text = output.substring(start + startStr.length).trim();
    
    // --- THE FIX: Delete the hidden JSON trace before showing the user! ---
    text = text.replace(/\[TRACE_START\][\s\S]*?\[TRACE_END\]\n?/g, '').trim();
    
    return text;
}







function renderLexicalOutput(text) {
    const container = document.getElementById("lex");
    container.innerHTML = "";

    const lines = text.split("\n");

    lines.forEach((line, i) => {
        const div = document.createElement("div");

        div.textContent = line;
        div.style.fontFamily = "monospace";
        div.style.color = "#e2e8f0";
        div.style.fontSize = "14px";
        div.style.opacity = 0;

        container.appendChild(div);

        setTimeout(() => {
            div.style.opacity = 1;
        }, i * 120);
    });
}






function extractLexical(output) {
    const start = output.indexOf("[LEXICAL_OUTPUT_START]");
    const end = output.indexOf("[LEXICAL_OUTPUT_END]");

    if (start === -1 || end === -1) return "";

    return output.substring(start + 23, end).trim();
}







function renderTokens(tokens) {
    const container = document.getElementById("lex");
    container.innerHTML = "";

    tokens.forEach((t, i) => {
        const line = document.createElement("div");

        line.innerHTML = `
            <span style="color:#38bdf8;">${t.type}</span>
            <span style="color:#94a3b8;"> → </span>
            <span style="color:#e2e8f0;">${t.value}</span>
        `;

        line.style.opacity = 0;

        container.appendChild(line);

        // animation
        setTimeout(() => {
            line.style.opacity = 1;
        }, i * 150);
    });
}





function getColor(type) {
    if (type.includes("Stmt")) return "#38bdf8";   // blue
    if (type === "String" || type === "Number") return "#22c55e"; // green
    if (type === "EncryptExpr" || type === "DecryptExpr") return "#f59e0b"; // orange
    if (type === "Program") return "#e879f9"; // purple
    return "#94a3b8"; // default
}




function getNodeMeaning(node) {
  if (!node) return "";

  switch (node.label) {

    case "LetStmt":
      return `let ${node.children[0].label.replace("name: ", "")} = ${getExpr(node.children[1])}`;

    case "AssignStmt":
      return `${node.children[0].label} = ${getExpr(node.children[1])}`;

    case "PrintStmt":
      return `print ${getExpr(node.children[0])}`;

    case "ReturnStmt":
      return `return ${getExpr(node.children[0])}`;

    case "FuncDef": {
      const name = node.children[0].label;
      const params = node.children[1].children.map(p => p.label).join(", ");
      return `function ${name}(${params})`;
    }

    case "IfStmt":
      return `if (${getExpr(node.children[0])})`;

    case "WhileStmt":
      return `while (${getExpr(node.children[0])})`;

    case "EncryptExpr":
      return `encrypt(${getExpr(node.children[0])})`;

    case "DecryptExpr":
      return `decrypt(${getExpr(node.children[0])})`;

    default:
      return "";
  }
}











function getExpr(node) {
  if (!node) return "";

  // leaf nodes
  if (!node.children || node.children.length === 0)
    return node.label;

  // binary operators
  if (["+", "-", "*", "/", ">", "<", "==", "!=", "<=", ">=", "&&", "||"].includes(node.label)) {
    return `${getExpr(node.children[0])} ${node.label} ${getExpr(node.children[1])}`;
  }

  // Var / Number / String wrappers
  if (node.label === "Var" || node.label === "Number" || node.label === "String") {
    return getExpr(node.children[0]);
  }

  // function call
  if (node.label === "FuncCall") {
    const name = node.children[0].label;
    const args = node.children[1].children.map(getExpr).join(", ");
    return `${name}(${args})`;
  }

  return node.label;
}




function convertNode(d) {
    return {
        label: d.name,
        children: d.children ? d.children.map(convertNode) : []
    };
}

function extractTree(output) {
    const match = output.match(/\[TREE_START\]([\s\S]*?)\[TREE_END\]/);

    if (!match) {
        console.error("Tree not found in output");
        return null;
    }

    try {
        return JSON.parse(match[1]);
    } catch (e) {
        console.error("Invalid JSON tree", e);
        return null;
    }
}



//  DRAW TREE (D3)
function drawTree(data) {
    d3.select("#tree").selectAll("*").remove();

    const root = d3.hierarchy(data);

    // Layout configuration: [vertical_spacing, horizontal_spacing]
    const dx = 40;  // Spacing between siblings vertically
    const dy = 200; // Spacing between parent/child layers horizontally
    
    const treeLayout = d3.tree().nodeSize([dx, dy]);
    treeLayout(root);

    // Calculate exact bounding box so the tree is never cut off
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;

    root.each(d => {
        if (d.x < x0) x0 = d.x;
        if (d.x > x1) x1 = d.x;
        if (d.y < y0) y0 = d.y;
        if (d.y > y1) y1 = d.y;
    });

    // Add padding to bounds (extra width for text labels on the right)
    const width = y1 - y0 + 400; 
    const height = x1 - x0 + 100;

    const svg = d3.select("#tree")
        .attr("viewBox", [0, 0, width, height])
        .style("background", "#020617")
        .style("width", "100%")
        .style("height", "100%");

    // Translate the tree to fit within our padded viewBox
    const g = svg.append("g")
        .attr("transform", `translate(${100 - y0}, ${50 - x0})`);

    // LINKS: Use D3's built-in smooth curve generator for horizontal trees
    const linkGenerator = d3.linkHorizontal()
        .x(d => d.y)
        .y(d => d.x);

    g.selectAll("path.link")
        .data(root.links())
        .enter()
        .append("path")
        .attr("class", "link")
        .attr("d", linkGenerator)
        .attr("fill", "none")
        .attr("stroke", "#334155") // Subtle path color
        .attr("stroke-width", 1.5)
        .style("opacity", 0)
        .transition()
        .duration(800)
        .style("opacity", 1);

    // NODES
    const nodesGroup = g.selectAll("g.node")
        .data(root.descendants())
        .enter()
        .append("g")
        .attr("class", "node")
        .attr("transform", d => `translate(${d.y},${d.x})`);

    // CIRCLE
    nodesGroup.append("circle")
        .attr("r", 0)
        .attr("fill", d => getColor(d.data.name))
        .transition()
        .delay((d, i) => i * 150)
        .attr("r", 6);

    // TEXT LABEL
    nodesGroup.append("text")
        .attr("dy", "0.31em")
        // Parent nodes put text on the left, leaf nodes put text on the right
        .attr("x", d => d.children ? -12 : 12) 
        .attr("text-anchor", d => d.children ? "end" : "start")
        .style("font-size", "13px")
        .style("font-family", "monospace")
        .style("opacity", 0)
        .each(function(d) {
            const text = d3.select(this);
            const meaning = getNodeMeaning(convertNode(d.data));

            // Main Label
            text.append("tspan")
                .attr("fill", "#e2e8f0")
                .attr("font-weight", "bold")
                .text(d.data.name);

            // Sub-meaning (only if it exists)
            if (meaning) {
                text.append("tspan")
                    .attr("fill", "#64748b")
                    .text(" → " + meaning);
            }
        })
        .transition()
        .delay((d, i) => i * 150)
        .style("opacity", 1);

    // TOOLTIP
    nodesGroup.append("title")
        .text(d => nodeInfo[d.data.name] || "Unknown node");
}

//  STEP ANIMATION
let stepIndex = 0;

function stepTree() {
    const nodes = document.querySelectorAll("circle");

    if (stepIndex < nodes.length) {
        nodes[stepIndex].setAttribute("fill", "#f59e0b");
        stepIndex++;
    } else {
        stepIndex = 0;
        nodes.forEach(n => n.setAttribute("fill", "#22c55e"));
    }
}




// Show/Hide Grammar selection based on Parser Type
document.addEventListener("DOMContentLoaded", () => {
    const parserCategory = document.getElementById("parserCategory");
    const parserType = document.getElementById("parserType");
    const grammarControl = document.getElementById("grammarControl");

    function checkGrammarVisibility() {
        // LL(1) is Category 1 (Top-Down) and Type 2
        if (parserCategory.value === "1" && parserType.value === "2") {
            grammarControl.style.display = "block";
        } else {
            grammarControl.style.display = "none";
        }
    }

    parserCategory.addEventListener("change", checkGrammarVisibility);
    parserType.addEventListener("change", checkGrammarVisibility);
});



// --- NEW: MEMORY TRACE ANIMATION ---
function extractTrace(output) {
    const match = output.match(/\[TRACE_START\]([\s\S]*?)\[TRACE_END\]/);
    if (!match) return null;
    try { return JSON.parse(match[1]); } catch(e) { return null; }
}

let memoryInterval = null; 

function animateMemory(traceData) {
    if (memoryInterval) clearInterval(memoryInterval);
    const tbody = document.querySelector("#memoryTable tbody");
    let i = 0;
    
    // Update the memory table every 100ms
    memoryInterval = setInterval(() => {
        if (i >= traceData.length) {
            clearInterval(memoryInterval);
            return;
        }
        
        const state = traceData[i];
        tbody.innerHTML = "";
        
        for (const [key, value] of Object.entries(state.memory)) {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td style="color:#38bdf8; padding: 5px 0;">${key}</td>
                <td style="color:#22c55e; padding: 5px 0;">${value}</td>
            `;
            tbody.appendChild(tr);
        }
        i++;
    }, 100); 
}


// --- NEW: SYMBOL TABLE VISUALIZER ---
function extractSymTab(output) {
    const match = output.match(/\[SYMTAB_START\]([\s\S]*?)\[SYMTAB_END\]/);
    if (!match) return null;
    try { return JSON.parse(match[1]); } catch(e) { return null; }
}

function renderSymTab(data) {
    const container = document.getElementById("symtab");
    if (!container) return;
    
    let html = `<table style="width:100%; border-collapse: collapse; font-family: monospace; text-align: left;">
        <thead>
            <tr style="border-bottom: 1px solid #334155; color: #94a3b8;">
                <th style="padding: 8px 5px;">Identifier</th>
                <th style="padding: 8px 5px;">Category</th>
                <th style="padding: 8px 5px;">Type / Signature</th>
            </tr>
        </thead>
        <tbody>`;
        
    // Draw Variables
    data.variables.forEach(v => {
        html += `<tr>
            <td style="color: #38bdf8; padding: 8px 5px; border-bottom: 1px solid #1e293b;">${v.name}</td>
            <td style="color: #e2e8f0; padding: 8px 5px; border-bottom: 1px solid #1e293b;">Variable</td>
            <td style="color: #22c55e; padding: 8px 5px; border-bottom: 1px solid #1e293b;">${v.type}</td>
        </tr>`;
    });

    // Draw Functions
    data.functions.forEach(f => {
        html += `<tr>
            <td style="color: #e879f9; padding: 8px 5px; border-bottom: 1px solid #1e293b;">${f.name}()</td>
            <td style="color: #e2e8f0; padding: 8px 5px; border-bottom: 1px solid #1e293b;">Function</td>
            <td style="color: #22c55e; padding: 8px 5px; border-bottom: 1px solid #1e293b;">${f.params} params → ${f.returnType}</td>
        </tr>`;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
}