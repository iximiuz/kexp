import type { KubeObject, KubeResource, KubeResourceGroup } from "../../common/types";

export interface Filter {
  resources: string[];
  names: string[];
}

export function parseFilterExpr(filterExpr: string | null): Filter[] {
  const filters: Filter[] = [];

  for (const subExpr of (filterExpr || "").trim().split(";")) {
    console.log("parsing filter expr", subExpr);
    const [resFilterExpr, nameFilterExpr] = subExpr.trim().split(/\s+/);

    const resFilters = resFilterExpr.toLowerCase().split(",").filter((f) => !!f);
    const nameFilters = (nameFilterExpr || "").split(",").filter((f) => !!f);

    if (resFilters.length > 0) {
      filters.push({
        resources: resFilters,
        names: nameFilters,
      });
    }
  }

  console.log("parsed filters", filters);
  return filters;
}

export function filterObjects(objects: KubeObject[], filters: Filter[]): KubeObject[] {
  if (objects.length === 0 || filters.every((f) => f.resources.length === 0 || f.names.length === 0)) {
    console.log("filtering objects - noop");
    return objects;
  }

  console.log("filtering objects", objects[0].resource.groupVersion + "/" + objects[0].resource.kind);

  const matched = new Set<string>();
  for (const f of filters) {
    console.log("matching object resource filter", f);
    if (_matchingResources([objects[0].resource], f.resources).length > 0) {
      console.log("matched object resource filter", f.resources);
      for (const obj of _matchingObjects(objects, f.names)) {
        matched.add(obj.ident);
      }
    }
  }

  return objects.filter((obj) => !!matched.has(obj.ident));
}

export function filterResources(resources: KubeResource[], filters: Filter[]): KubeResource[] {
  console.log("filtering resources");
  if (filters.length === 0) {
    return resources;
  }

  const resFilters = filters.flatMap((f) => f.resources);
  console.log("matched resources", _matchingResources(resources, resFilters));
  return _matchingResources(resources, resFilters);
}

export function filterResourceGroups(groups: KubeResourceGroup[], filters: Filter[]): KubeResourceGroup[] {
  if (filters.length === 0) {
    return groups;
  }

  const resFilters = filters.flatMap((f) => f.resources);
  return groups.filter((group) => {
    return _matchingResources(group.resources || [], resFilters).length > 0;
  });
}

export function isApplicableObjectFilterExpr(res: KubeResource, filterExpr: string | null, filters: Filter[]): boolean {
  if (!filterExpr) {
    return false;
  }

  for (const f of filters) {
    if (_matchingResources([res], f.resources).length === 0) {
      continue;
    }

    console.log("matched resource filter", f.resources);
    for (const expr of f.names) {
      if (expr === "*") {
        return true;
      }

      const hasSlash = expr.indexOf("/") !== -1;
      if (!res.namespaced && hasSlash) {
        continue;
      }
      if (res.namespaced && !hasSlash) {
        continue;
      }

      const [ns, name] = expr.split("/");
      if (ns !== "*" && ns.length < 2) {
        continue;
      }

      if (hasSlash && (name === "*" || (name || "").length > 1)) {
        return true;
      }

      if (!hasSlash && (expr === "*" || (expr || "").length > 1)) {
        return true;
      }
    }
  }

  return false;
}

function _matchingObjects(objects: KubeObject[], filters: string[]): KubeObject[] {
  return objects.filter((obj) => !!filters.find((f) => {
    if (f === "*") {
      return true;
    }

    if (f.indexOf("/") === -1) {
      return !obj.resource.namespaced && _match(f, obj.name);
    }

    if (!obj.resource.namespaced) {
      return false;
    }

    const [ns, name] = f.split("/");
    return _match(ns, obj.namespace || "") && _match(name || "", obj.name);
  }));
}

function _matchingResources(resources: KubeResource[], filters: string[]): KubeResource[] {
  return resources.filter((res) => !!filters.find((f) => {
    return f.length > 1 && (
      res.name.toLowerCase().startsWith(f) ||
      !!(res.shortNames || []).find((s) => s === f)
    );
  }));
}

function _match(expr: string, value: string): boolean {
  return expr === "*" || (expr.length > 1 && value.toLowerCase().startsWith(expr));
}
