Rails.application.routes.draw do
  resources :providers, only: %i[index show] do
    member do
      get :clients
      get :journal_entries
    end
  end

  resources :clients, only: %i[index show] do
    member { get :providers }
    resources :journal_entries, only: %i[index create]
  end
end
