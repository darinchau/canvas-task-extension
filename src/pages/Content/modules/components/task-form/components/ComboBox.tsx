import React, { useState } from 'react';
import styled from 'styled-components';

type StyledComboBoxProps = {
  disabled?: boolean;
};

const StyledComboBox = styled.select<StyledComboBoxProps>`
  font-size: 16px;
  border-radius: 4px;
  padding: 10px;
  margin-top: 10px;
  cursor: ${(props) => (props.disabled ? 'default' : 'pointer')};
`;

type Props = {
  value: number;
  maxDuplication: number;
  onChange: (value: number) => void;
};

export default function ComboBox({
  value,
  maxDuplication,
  onChange,
}: Props): JSX.Element {
  function handleValueChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const newValue = parseInt(event.target.value, 10);
    onChange(newValue);
  }

  function createKeys(n: number): number[] {
    return Array.from({ length: n }, (_, index) => index + 1);
  }

  return (
    <StyledComboBox onChange={handleValueChange} value={value.toString()}>
      {createKeys(maxDuplication).map((num) => (
        <option key={num} value={num}>
          {num}
        </option>
      ))}
    </StyledComboBox>
  );
}
