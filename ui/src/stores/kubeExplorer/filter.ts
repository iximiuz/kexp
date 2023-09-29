import type { KubeObject, KubeResource, KubeResourceGroup } from "../../common/types";

export function filterObjects(objects: KubeObject[], filterExpr: string | null): KubeObject[] {
  const [resFilters, nameFilters] = _parseFilterExpr(filterExpr);
  if (objects.length === 0 || resFilters.length === 0 || nameFilters.length === 0) {
    return objects;
  }

  if (_matchingResources([objects[0].resource], resFilters).length === 0) {
    return [];
  }

  return _matchingObjects(objects, nameFilters);
}

export function filterResources(resources: KubeResource[], filterExpr: string | null): KubeResource[] {
  if (!filterExpr) {
    return resources;
  }

  const [resFilters] = _parseFilterExpr(filterExpr);
  return _matchingResources(resources, resFilters);
}

export function filterResourceGroups(groups: KubeResourceGroup[], filterExpr: string | null): KubeResourceGroup[] {
  if (!filterExpr) {
    return groups;
  }

  const [resFilters] = _parseFilterExpr(filterExpr);
  return groups.filter((group) => {
    return _matchingResources(group.resources || [], resFilters).length > 0;
  });
}

export function isApplicableObjectFilterExpr(res: KubeResource, filterExpr: string | null): boolean {
  if (!filterExpr) {
    return true;
  }

  const expr = filterExpr.split(/\s+/)[1];
  if (!expr) {
    return false;
  }

  if (expr === "*") {
    return true;
  }

  const hasSlash = expr.indexOf("/") !== -1;
  if (!res.namespaced && hasSlash) {
    return false;
  }
  if (res.namespaced && !hasSlash) {
    return false;
  }

  const [ns, name] = expr.split("/");
  if (ns !== "*" && ns.length < 2) {
    return false;
  }

  if (hasSlash) {
    return name === "*" || (name || "").length > 1;
  }

  return true;
}

function _parseFilterExpr(filterExpr: string | null): [string[], string[]] {
  const [resFilterExpr, nameFilterExpr] = (filterExpr || "").trim().split(/\s+/);

  const resFilters = resFilterExpr.toLowerCase().split(",");
  const nameFilters = (nameFilterExpr || "").split(",");

  return [
    resFilters.filter((f) => !!f),
    nameFilters.filter((f) => !!f),
  ];
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
