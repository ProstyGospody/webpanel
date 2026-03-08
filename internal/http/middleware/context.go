package middleware

import (
	"context"

	"proxy-panel/internal/repository"
)

type contextKey string

const (
	ctxAdminKey   contextKey = "admin"
	ctxSessionKey contextKey = "session"
)

func WithAdmin(ctx context.Context, admin repository.Admin) context.Context {
	return context.WithValue(ctx, ctxAdminKey, admin)
}

func WithSession(ctx context.Context, session repository.Session) context.Context {
	return context.WithValue(ctx, ctxSessionKey, session)
}

func AdminFromContext(ctx context.Context) (repository.Admin, bool) {
	admin, ok := ctx.Value(ctxAdminKey).(repository.Admin)
	return admin, ok
}

func SessionFromContext(ctx context.Context) (repository.Session, bool) {
	session, ok := ctx.Value(ctxSessionKey).(repository.Session)
	return session, ok
}

