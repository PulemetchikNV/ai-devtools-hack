graph TD
    %% --- СТИЛИ ---
    classDef user fill:#f9f,stroke:#333,stroke-width:2px,color:black;
    classDef bot fill:#29B6F6,stroke:#333,stroke-width:2px,color:white,font-weight:bold;
    classDef cloud fill:#212121,stroke:#00C853,stroke-width:4px,color:white;
    classDef agent fill:#00C853,stroke:#333,stroke-width:2px,color:white,font-weight:bold;
    classDef mcp fill:#FFD600,stroke:#333,stroke-width:2px,color:black,stroke-dasharray: 5 5;
    classDef external fill:#ECEFF1,stroke:#333,stroke-width:1px,color:black;

    %% --- ПОЛЬЗОВАТЕЛЬ И БОТ ---
    User(👨‍💼 Team Lead):::user -->|"1. /check_mrs<br>Что висит в Backend?"| Bot
    
    subgraph "Telegram UI (Рамис)"
        Bot(🤖 Aiogram Bot):::bot
        DB[(User DB\nPostgres)]:::bot
    end
    
    Bot <-->|"2. Auth &<br>Save Context"| DB
    Bot -->|"3. Send to A2A API<br>(HTTP Request)"| AgentSystem

    %% --- CLOUD.RU EVOLUTION ---
    subgraph "☁️ Cloud.ru Evolution (Андрей)"
        AgentSystem{Orchestrator}:::cloud
        
        subgraph "Agent Logic"
            GitAgent[🦊 GitLab Manager Agent]:::agent
        end
    end

    AgentSystem -->|"4. Route Message"| GitAgent

    %% --- MCP SERVER ---
    subgraph "🛠️ Custom MCP Server (Родион)"
        GitMCP(📦 mcp-gitlab-server):::mcp
        
        %% Список инструментов внутри узла для наглядности
        note[<b>MVP Tools List:</b><br/>1. list_projects_by_name<br/>2. get_open_merge_requests<br/>3. get_file_content<br/>4. get_commit_history<br/>5. register_webhook]
        
        GitMCP --- note
    end

    %% --- СВЯЗИ ---
    GitAgent -->|"5. Call Tool:<br>get_open_merge_requests(id)"| GitMCP
    
    %% --- ВНЕШНИЙ МИР ---
    subgraph "🌍 External API"
        GitLabAPI((GitLab.com /<br>Self-hosted)):::external
    end

    GitMCP <-->|"6. API Request<br>(python-gitlab)"| GitLabAPI

    %% --- ВОЗВРАТ ---
    GitLabAPI -.->|"7. JSON Data"| GitMCP
    GitMCP -.->|"8. Tool Result"| GitAgent
    GitAgent -.->|"9. Summary Text"| AgentSystem
    AgentSystem -.->|"10. Response"| Bot
    Bot -.->|"11. Message"| User

    %% Стили стрелок
    linkStyle default stroke-width:2px,fill:none,stroke:gray;