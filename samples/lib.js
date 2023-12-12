const getTemplate = (id) => document.getElementById(id).content;

class IfSyntax {
  constructor(statement){
    this.type = "if";
    this.cases = [[statement, []]];
  }

  addCase(statement){
    this.cases.push([statement, []]);
  }

  addNode(node){
    this.cases[this.cases.length - 1][1].push(node);
  }
}

class EachSyntax {
  constructor(collectionVarName, itemVarName, keyVarName=null){
    this.type = "each";
    this.collectionVarName = collectionVarName;
    this.itemVarName = itemVarName;
    this.keyVarName = keyVarName;
    this.block = [];
  }

  addNode(node){
    this.block.push(node);
  }
}

const createNode = (tag, children) => {
  tag.innerHTML = "";
  return {
    type: "node",
    tag,
    children
  };
}

const createToken = (type, content=null) => {
  return {type, content};
}

const evaluate = (statement, env) => {
  const variableDefinitions = env.variables.map((key) => {
    const v = env[key];
    if(typeof v === "function"){
      return `const ${key} = ${v.toString()};`;
    }else{
      return `const ${key} = ${JSON.stringify(v)};`;
    }
  });

  return eval(`${variableDefinitions.join("")};${statement};`);
}

const parseTextNode = (text) => {
  const nodes = [];
  let matched;

  text = text.replaceAll("\n", " ");
  while(matched = text.match(/^(.*?)\{(.+?)\}(.*?)$/)){
    nodes.push(createToken("text", matched[1]));

    const statement = matched[2];
    let matched2;
    if(matched2 = statement.match(/^\#if\s(.+)$/)){
      nodes.push(createToken("if", matched2[1]));

    }else if(matched2 = statement.match(/^:else\s+if\s(.+)$/)){
      nodes.push(createToken("elseif", matched2[1]));

    }else if(statement.match(/^:else/)){
      nodes.push(createToken("elseif", "1"));

    }else if(statement.match(/^\/if$/)){
      nodes.push(createToken("endif"));

    }else if(matched2 = statement.match(/^#template\s+(.+?)\s*$/)){
      nodes.push(createToken("template", matched2[1]));

    }else if(matched2 = statement.match(/^#each\s([a-zA-z][a-zA-Z0-9]+)\sas\s([a-zA-z][a-zA-Z0-9]*)(\s*,\s*([a-zA-z][a-zA-Z0-9]*))?\s*$/)){
      if(matched2[4]){
        nodes.push(createToken("each", [matched2[1], matched2[2], matched2[4]]));
      }else{
        nodes.push(createToken("each", [matched2[1], matched2[2]]));
      }

    }else if(statement.match(/^\/each$/)){
      nodes.push(createToken("endeach"));

    }else{
      nodes.push(createToken("statement", statement));
    }
    text = matched[3];
  }

  nodes.push(createToken("text", text));
  return nodes.filter(node => node.content !== "");
}

const parse = (node) => {
  const _parse = (walker, ast) => {
    const ret = [];

    if (walker.firstChild()) {
      do {
        const node = walker.currentNode;
        switch(node.nodeType){
          case node.ELEMENT_NODE:
            ast.push(createNode(node.cloneNode(), _parse(walker, [])));
            break;

          case node.TEXT_NODE:
            const text = node.nodeValue.trim();
            ast.push(...parseTextNode(text));
            break;
        }
      } while(walker.nextSibling());

      walker.parentNode();

      const syntaxStack = [];
      ast.forEach((token) => {
        switch(token.type){
          case "if":
            syntaxStack.push(new IfSyntax(token.content));
            break;

          case "each":
            syntaxStack.push(new EachSyntax(...token.content));
            break;

        }

        const currentSyntax = syntaxStack[syntaxStack.length - 1];
        const prevSyntax = syntaxStack[syntaxStack.length - 2];
        if(currentSyntax){
          switch(token.type){
            case "node":
            case "text":
            case "statement":
            case "template":
              currentSyntax.addNode(token);
              break;

            case "elseif":
              currentSyntax.addCase(token.content);
              break;

            case "endif":
              if(currentSyntax.type !== "if") throw new SyntaxError;
              if(prevSyntax){
                prevSyntax.addNode(currentSyntax)
              }else{
                ret.push(currentSyntax);
              }
              syntaxStack.pop();
              break;

            case "endeach":
              if(currentSyntax.type !== "each") throw new SyntaxError;
              if(prevSyntax){
                prevSyntax.addNode(currentSyntax)
              }else{
                ret.push(currentSyntax);
              }
              syntaxStack.pop();
              break;
          }

        }else{
          switch(token.type){
            case "node":
            case "text":
            case "statement":
            case "template":
              ret.push(token);
              break;

            default:
              throw new SyntaxError();
          }
        }
      });
    }
    return ret;
  };

  const walker = document.createTreeWalker(node);
  return _parse(walker, []);
}


const update = (parent, ast, env) => {
  ast.forEach((node) => {
    switch(node.type){
      case "text":
        parent.append(node.content);
        break;

      case "statement":
        parent.append(evaluate(node.content, env));
        break;

      case "node":
        const child = node.tag.cloneNode();

        for(let i=0; i<child.attributes.length; i++){
          const attr = child.attributes[i];

          if(attr.specified){
            let matched;

            if(matched = attr.value.match(/^\{(.+?)\}$/)){
              const v = evaluate(matched[1], env);

              switch(typeof v){
                case "boolean":
                  if(v){
                    attr.value = "";
                  }else{
                    child.removeAttribute(attr.name);
                    i--;
                  }
                  break;

                default:
                  attr.value = v;
              }
            }
          }
        }

        update(child, node.children, env);
        parent.appendChild(child);
        break;

      case "template":
        const ast = parse(getTemplate(node.content));
        update(parent, ast, env);
        break;

      case "if":
        node.cases.some(([expression, block]) => {
          if(evaluate(expression, env)){
            update(parent, block, env);
            return true;
          }
        });
        break;

      case "each":
        const collection = env[node.collectionVarName];
        const prevItemVal = env[node.itemVarName];
        const prevKeyVal = node.keyVarName ? env[node.keyVarName] : null;

        Object.entries(collection).forEach(([k, v]) => {
          env.set(node.itemVarName, v);
          if(node.keyVarName) env.set(node.keyVarName, k);
          update(parent, node.block, env);
        });

        env.set(node.itemVarName, prevItemVal);
        if(node.keyVarName) env.set(node.keyVarName, prevKeyVal);
        break;
    }
  });

  return parent;
};

export const createEnv = (o) => {
  const _env = {...o};

  const env = {
    get variables(){return Object.keys(_env)},
    set: (k, v) => {
      if(!Object.getOwnPropertyNames(env).includes(k)){
        Object.defineProperty(env, k, {
          get: () => _env[k]
        });
      }
      _env[k] = v;
    },
    updaters: []
  };

  Object.entries(o).forEach(([k, v]) => {
    Object.defineProperty(env, k, {
      get: () => _env[k],
      set: (v) => {
        _env[k] = v;
        env.updaters.forEach(update => update())
      }
    });
  });

  return env;
};

export const app = (selector, env, callback) => {
  const app = document.querySelector(selector);

  const template = app.dataset.useTemplate ?
    document.getElementById(app.dataset.useTemplate).content :
    app.querySelector(":scope > template").content;

  const ast = parse(template);

  const f = () => {
    app.innerHTML = "";
    update(app, ast, env);
    if(callback) callback();
  };

  env.updaters.push(f);
  f();
};
