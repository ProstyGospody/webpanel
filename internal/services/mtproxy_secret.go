package services

import mtproxydomain "proxy-panel/internal/domain/mtproxy"

func NormalizeMTProxySecret(input string) (string, error) {
	return mtproxydomain.NormalizeSecret(input)
}

func BuildTelegramShareURL(host string, port int, canonicalSecret string) (string, error) {
	return mtproxydomain.BuildTelegramShareURL(host, port, canonicalSecret)
}

func BuildTelegramDeepLink(host string, port int, canonicalSecret string) (string, error) {
	return mtproxydomain.BuildTelegramDeepLink(host, port, canonicalSecret)
}

func NormalizeHost(raw string) string {
	return mtproxydomain.NormalizeHost(raw)
}
