import {
  ClientOverrides,
  HysteriaClient,
  HysteriaClientCreateRequest,
  HysteriaClientDefaults,
  HysteriaClientUpdateRequest,
} from "@/domain/clients/types";

type ClientFormValues = {
  username: string;
  note: string;
  authSecret: string;
  overrideSni: string;
  overrideInsecure: "inherit" | "true" | "false";
  overridePin: string;
  overrideObfs: "inherit" | "salamander";
  overrideObfsPassword: string;
};

export function defaultsSummary(defaults: HysteriaClientDefaults | null): string {
  if (!defaults) {
    return "Server defaults are loading";
  }
  const params = defaults.client_params;
  const options = defaults.server_options;
  const parts = [
    `${params.server}:${params.port}`,
    params.sni ? `SNI ${params.sni}` : "",
    options.obfs_type ? `OBFS ${options.obfs_type}` : "",
    options.masquerade_type ? `Masquerade ${options.masquerade_type}` : "",
  ].filter(Boolean);
  return parts.join(" | ");
}

export function formFromClient(client: HysteriaClient | null): ClientFormValues {
  const overrides = client?.client_overrides || null;
  return {
    username: client?.username || "",
    note: client?.note || "",
    authSecret: "",
    overrideSni: overrides?.sni || "",
    overrideInsecure: overrides?.insecure === undefined ? "inherit" : overrides.insecure ? "true" : "false",
    overridePin: overrides?.pinSHA256 || "",
    overrideObfs: overrides?.obfsType === "salamander" ? "salamander" : "inherit",
    overrideObfsPassword: overrides?.obfsPassword || "",
  };
}

export function toCreateRequest(values: ClientFormValues): HysteriaClientCreateRequest {
  const payload: HysteriaClientCreateRequest = {
    username: values.username,
  };
  if (values.note.trim()) {
    payload.note = values.note.trim();
  }
  if (values.authSecret.trim()) {
    payload.auth_secret = values.authSecret.trim();
  }
  const overrides = toOverrides(values);
  if (overrides) {
    payload.client_overrides = overrides;
  }
  return payload;
}

export function toUpdateRequest(values: ClientFormValues): HysteriaClientUpdateRequest {
  const payload: HysteriaClientUpdateRequest = {
    username: values.username,
  };
  if (values.note.trim()) {
    payload.note = values.note.trim();
  }
  if (values.authSecret.trim()) {
    payload.auth_secret = values.authSecret.trim();
  }

  const hasOverrideIntent =
    values.overrideSni.trim() !== "" ||
    values.overrideInsecure !== "inherit" ||
    values.overridePin.trim() !== "" ||
    values.overrideObfs === "salamander";

  if (hasOverrideIntent) {
    payload.client_overrides = toOverrides(values) || {};
  } else {
    payload.client_overrides = {};
  }

  return payload;
}

function toOverrides(values: ClientFormValues): ClientOverrides | undefined {
  const overrides: ClientOverrides = {};
  if (values.overrideSni.trim()) {
    overrides.sni = values.overrideSni.trim();
  }
  if (values.overrideInsecure === "true") {
    overrides.insecure = true;
  }
  if (values.overrideInsecure === "false") {
    overrides.insecure = false;
  }
  if (values.overridePin.trim()) {
    overrides.pinSHA256 = values.overridePin.trim();
  }
  if (values.overrideObfs === "salamander") {
    overrides.obfsType = "salamander";
    if (values.overrideObfsPassword.trim()) {
      overrides.obfsPassword = values.overrideObfsPassword.trim();
    }
  }

  return Object.keys(overrides).length ? overrides : undefined;
}

export type { ClientFormValues };
