import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <h1 className="text-4xl font-bold text-white font-heading">404</h1>
      <p className="mt-2 text-muted-foreground">Página não encontrada</p>
      <Link to="/" className="mt-4 text-sm text-primary hover:text-primary/80">
        Voltar ao início
      </Link>
    </div>
  )
}
