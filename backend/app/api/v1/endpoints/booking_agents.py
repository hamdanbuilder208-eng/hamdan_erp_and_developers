from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.errors import delete_with_fk_guard
from app.crud import booking_agent as agent_crud
from app.db.session import get_db
from app.schemas.booking_agent import (
    BookingAgentCreate,
    BookingAgentOut,
    BookingAgentSummary,
    BookingAgentUpdate,
)

router = APIRouter()


@router.get("/", response_model=list[BookingAgentOut])
def list_agents(db: Session = Depends(get_db)):
    return agent_crud.list_agents(db)


@router.post("/", response_model=BookingAgentOut, status_code=status.HTTP_201_CREATED)
def create_agent(agent_in: BookingAgentCreate, db: Session = Depends(get_db)):
    return agent_crud.create_agent(db, agent_in)


@router.get("/{agent_id}", response_model=BookingAgentOut)
def get_agent(agent_id: int, db: Session = Depends(get_db)):
    db_agent = agent_crud.get_agent(db, agent_id)
    if not db_agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return db_agent


@router.get("/{agent_id}/summary", response_model=BookingAgentSummary)
def get_agent_summary(agent_id: int, db: Session = Depends(get_db)):
    summary = agent_crud.get_agent_summary(db, agent_id)
    if not summary:
        raise HTTPException(status_code=404, detail="Agent not found")
    return summary


@router.put("/{agent_id}", response_model=BookingAgentOut)
def update_agent(agent_id: int, agent_in: BookingAgentUpdate, db: Session = Depends(get_db)):
    db_agent = agent_crud.get_agent(db, agent_id)
    if not db_agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent_crud.update_agent(db, db_agent, agent_in)


@router.delete("/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_agent(agent_id: int, db: Session = Depends(get_db)):
    db_agent = agent_crud.get_agent(db, agent_id)
    if not db_agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    delete_with_fk_guard(db, lambda: agent_crud.delete_agent(db, db_agent), "agent")
